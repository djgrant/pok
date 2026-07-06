/**
 * CLI entry point for @pokit/core
 *
 * This module provides the runCli() function that handles the full CLI lifecycle:
 * - Running the router with pre-resolved configuration
 * - Returning a process exit code (0 success, non-zero failure)
 *
 * Usage:
 *   import { runCli } from '@pokit/core';
 *   const exitCode = await runCli(process.argv.slice(2), {
 *     commandsDir: '/path/to/commands',
 *     projectRoot: '/path/to/project',
 *     reporterAdapter: createReporterAdapter(),
 *     prompter: createPrompter(),
 *   });
 *   process.exitCode = exitCode;
 */

import * as path from 'path';
import { run } from './lib/router';
import { isOperationalError, wasPresented } from './lib/errors';
import { CommandError } from './lib/runner';
import { detectOutputConfig, extractOutputFlags } from './lib/output-config';
import type { ReporterAdapter } from './events';
import type { Prompter, Navigator } from './prompter';
import type { ContextDef } from './lib/command';

/**
 * Configuration for runCli
 *
 * All paths must be absolute and already resolved.
 * Adapters must be instantiated and ready to use.
 */
export type RunCliConfig = {
  /** Absolute path to directory containing command files */
  commandsDir: string;
  /** Absolute path to project root for running shell commands */
  projectRoot: string;
  /** App name for CLI display */
  appName?: string;
  /** Reporter adapter (instantiated) */
  reporterAdapter: ReporterAdapter;
  /** Prompter (instantiated) */
  prompter: Prompter;
  /** Optional navigator for menu presentation policy (defaults to built-in) */
  navigator?: Navigator;
  /** Optional version string for --version flag */
  version?: string;
  /**
   * Package manager scripts to include as commands.
   * - true: Include all scripts from root package.json
   * - string[]: List of script names, glob patterns (e.g. 'test:*'),
   *   or package discovery paths (e.g. 'packages/*')
   */
  pmScripts?: boolean | string[];

  /**
   * Native package manager commands to include (e.g. 'install', 'add', 'run').
   * - true: Include standard lifecycle commands
   * - string[]: List of specific commands to include
   */
  pmCommands?: boolean | string[];

  /**
   * Extra commands to inject into the tree manually.
   * Useful for dynamically generated commands or internal tooling.
   */
  extraCommands?: Record<string, import('./lib/command').CommandConfig>;

  /**
   * Plugins to mount at the root.
   * Allows injecting dynamic command sources.
   */
  plugins?: import('./lib/command').MountableLike[];
  /**
   * App-level global flags accepted regardless of position.
   * These flags are stripped before command matching.
   */
  globalContext?: ContextDef;
  /**
   * Optional hook called once global flags are parsed/validated.
   * Useful for wiring parsed values into app-specific runtime state.
   */
  onGlobalContext?: (context: Record<string, unknown>) => void | Promise<void>;

  /**
   * Whether runCli should rethrow errors after handling/logging.
   *
   * Defaults to false for pit-of-success entrypoint behavior.
   * Set to true for programmatic callers that want to catch failures.
   */
  throwOnError?: boolean;
};

/** Marks stdin so the teardown error listener is only attached once. */
const TEARDOWN_GUARD = Symbol.for('pokit.stdin.teardownGuard');

/**
 * Restore the terminal after the CLI finishes.
 *
 * Interactive prompts/menus (clack) create a readline interface on
 * `process.stdin` with `terminal: true`, which puts stdin into raw mode and
 * resumes it. clack's own teardown clears raw mode and the keypress listener
 * but never pauses the stream, so stdin is left as an active handle. That keeps
 * the Node event loop alive after the command completes — the process hangs and
 * control is never handed back to the shell until the user hits Ctrl+C again.
 *
 * A lingering, resumed stdin is also prone to surfacing a stray `read EIO` (or
 * `EBADF`) from the TTY during teardown — for example after a long-running child
 * that manipulated the terminal. With a readline interface still attached and no
 * `error` listener, Node re-throws that as a fatal "Unhandled 'error' event",
 * crashing the process after it should have exited cleanly.
 *
 * Pausing stdin and swallowing those specific teardown read errors makes exit
 * deterministic and quiet.
 */
function restoreTerminal(): void {
  const stdin = process.stdin as NodeJS.ReadStream & { [TEARDOWN_GUARD]?: true };
  if (!stdin) return;

  // Swallow only the benign TTY read errors that can fire while the stream is
  // being torn down; anything else is left to propagate normally. Attach once
  // so repeated runCli() calls (e.g. in tests) don't leak listeners.
  if (!stdin[TEARDOWN_GUARD]) {
    stdin[TEARDOWN_GUARD] = true;
    stdin.on('error', (err: NodeJS.ErrnoException) => {
      if (err && (err.code === 'EIO' || err.code === 'EBADF')) {
        return;
      }
      throw err;
    });
  }

  try {
    if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(false);
    }
  } catch {
    // setRawMode can throw if the fd is already gone; nothing to restore.
  }

  // Release the handle so the event loop can drain and the process exits.
  stdin.pause();
}

/**
 * Extract detailed error information from process execution errors
 */
function getErrorDetails(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error);
  }

  const err = error as Record<string, unknown>;

  // Check for tinyexec-style output property
  if (err.output && typeof err.output === 'object') {
    const output = err.output as Record<string, unknown>;
    const parts: string[] = [];

    if (output.stderr) {
      parts.push(String(output.stderr).trim());
    }
    if (output.stdout) {
      parts.push(String(output.stdout).trim());
    }

    if (parts.length > 0) {
      return parts.filter(Boolean).join('\n');
    }
  }

  // Fall back to error message
  if (err.message) {
    return String(err.message);
  }

  return String(error);
}

/**
 * Run the CLI with the given arguments and pre-resolved configuration
 *
 * @param args - Command line arguments (without 'node' and script name)
 * @param config - Resolved configuration with all paths and adapters
 * @returns Process-style exit code
 */
export async function runCli(args: string[], config: RunCliConfig): Promise<number> {
  const { commandsDir, projectRoot, reporterAdapter, prompter, version } = config;

  // Detect output configuration from args
  const { outputArgs, remainingArgs } = extractOutputFlags(args);
  const outputConfig = detectOutputConfig(outputArgs);
  const noTty = !outputConfig.interactive;

  // Get app name (default to directory name)
  const appName = config.appName ?? path.basename(projectRoot);

  try {
    await run(remainingArgs, {
      commandsDir,
      projectRoot,
      appName,
      version,
      reporterAdapter,
      prompter,
      navigator: config.navigator,
      noTty,
      outputFormat: outputConfig.format,
      pmScripts: config.pmScripts,
      pmCommands: config.pmCommands,
      extraCommands: config.extraCommands,
      plugins: config.plugins,
      globalContext: config.globalContext,
      onGlobalContext: config.onGlobalContext,
    });
    return 0;
  } catch (error) {
    // Operational errors are expected failures (a subprocess exiting non-zero,
    // a bad flag, a failed check, a cancellation). Their message — and, for a
    // CommandError, the captured subprocess output — is the useful diagnostic;
    // a stack trace back into pok's own source frames is only noise. Present a
    // clean message and never a stack.
    if (isOperationalError(error)) {
      if (config.throwOnError) {
        throw error;
      }

      const rawExitCode = (error as { exitCode?: unknown }).exitCode;
      const exitCode = typeof rawExitCode === 'number' && Number.isFinite(rawExitCode)
        ? rawExitCode
        : 1;

      // Only print if a presenter (e.g. the reporter's failure box) hasn't
      // already surfaced this error, to avoid showing it twice.
      if (!wasPresented(error)) {
        console.error(`Error: ${error.message}`);
        if (error instanceof CommandError && error.output) {
          console.error(error.output);
        }
      }

      process.exitCode = exitCode;
      return exitCode;
    }

    // Handle unexpected errors. Always surface the full error — we never hide
    // errors from the user behind a debug flag.
    const errorDetails = getErrorDetails(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Show the detailed error (stderr/stdout from process) if it adds anything
    // beyond the message, then always show the full error (including stack).
    if (errorDetails !== errorMessage) {
      console.error(`Error: ${errorDetails}`);
    }
    console.error('Error:', error);

    if (config.throwOnError) {
      throw error;
    }

    process.exitCode = 1;
    return 1;
  } finally {
    // Release stdin so the event loop can drain and hand control back to the
    // shell, and neutralize any stray TTY read error during teardown.
    restoreTerminal();
  }
}
