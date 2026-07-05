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
  }
}
