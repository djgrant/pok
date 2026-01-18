/**
 * CLI entry point for @pokit/core
 *
 * This module provides the runCli() function that handles the full CLI lifecycle:
 * - Running the router with pre-resolved configuration
 *
 * Usage:
 *   import { runCli } from '@pokit/core';
 *   await runCli(process.argv.slice(2), {
 *     commandsDir: '/path/to/commands',
 *     projectRoot: '/path/to/project',
 *     reporterAdapter: createReporterAdapter(),
 *     prompter: createPrompter(),
 *   });
 */

import * as path from 'path';
import { run, RouterError } from './lib/router';
import { detectOutputConfig, extractOutputFlags } from './lib/output-config';
import type { ReporterAdapter } from './events';
import type { Prompter } from './prompter';
import type { TabsAdapter } from './tabs';

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
  /** Optional tabs adapter (instantiated) */
  tabs?: TabsAdapter;
   /** Optional version string for --version flag */
   version?: string;
   /** NPM scripts to include as commands */
   npmScripts?: boolean | string[];
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
 */
export async function runCli(args: string[], config: RunCliConfig): Promise<void> {
  const { commandsDir, projectRoot, reporterAdapter, prompter, tabs, version } = config;

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
       tabs,
       noTty,
       npmScripts: config.npmScripts,
     });
   } catch (error) {

    if (error instanceof RouterError) {
      process.exit(error.exitCode);
    }

    // Handle unexpected errors with clean messages
    const isDebug = process.env.DEBUG !== undefined;
    const errorDetails = getErrorDetails(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isDebug) {
      // In debug mode, show full stack trace
      console.error('Error:', error);
    } else {
      // Show the detailed error (stderr/stdout from process) if available
      if (errorDetails !== errorMessage) {
        console.error(`Error: ${errorDetails}`);
      } else {
        console.error(`Error: ${errorMessage}`);
      }
      console.error('\nSet DEBUG=1 for full stack trace.');
    }

    process.exit(1);
  }
}
