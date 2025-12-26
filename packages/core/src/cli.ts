/**
 * CLI entry point for @openpok/core
 *
 * This module provides the runCli() function that handles the full CLI lifecycle:
 * - Finding the project root and commands directory
 * - Loading reporter and prompter adapters
 * - Running the router
 *
 * Usage:
 *   import { runCli } from '@openpok/core';
 *   await runCli(process.argv.slice(2));
 */

import * as path from 'path';
import * as fs from 'fs';
import { run, RouterError } from './lib/router';
import { detectOutputConfig, extractOutputFlags } from './lib/output-config';

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

/**
 * Find commands directory
 */
function findCommandsDir(projectRoot: string): string | null {
  // Check for commands/ in project root
  const rootCommands = path.join(projectRoot, 'commands');
  if (fs.existsSync(rootCommands)) {
    return rootCommands;
  }

  // Check for cli/commands/ in project root
  const cliCommands = path.join(projectRoot, 'cli', 'commands');
  if (fs.existsSync(cliCommands)) {
    return cliCommands;
  }

  return null;
}

/**
 * Run the CLI with the given arguments
 *
 * @param args - Command line arguments (without 'node' and script name)
 * @param options - Optional overrides for project root, commands dir, etc.
 */
export async function runCli(
  args: string[],
  options?: {
    projectRoot?: string;
    commandsDir?: string;
    appName?: string;
  }
): Promise<void> {
  const projectRoot = options?.projectRoot ?? findProjectRoot(process.cwd());
  const commandsDir = options?.commandsDir ?? findCommandsDir(projectRoot);

  if (!commandsDir) {
    console.error(
      'Error: No commands directory found.\n' +
        'Create a `commands/` directory in your project root with command files.'
    );
    process.exit(1);
  }

  // Detect output configuration from args
  const { outputArgs, remainingArgs } = extractOutputFlags(args);
  const outputConfig = detectOutputConfig(outputArgs);

  // Dynamically import the adapters - they're peer dependencies
  let createReporterAdapter: (options?: { output?: typeof outputConfig }) => any;
  let createPrompter: () => any;

  try {
    const reporterModule = await import('@openpok/reporter-clack');
    createReporterAdapter = reporterModule.createReporterAdapter;
  } catch {
    console.error(
      'Error: @openpok/reporter-clack is required.\n' +
        'Install it with: bun add @openpok/reporter-clack'
    );
    process.exit(1);
  }

  try {
    const prompterModule = await import('@openpok/prompter-clack');
    createPrompter = prompterModule.createPrompter;
  } catch {
    console.error(
      'Error: @openpok/prompter-clack is required.\n' +
        'Install it with: bun add @openpok/prompter-clack'
    );
    process.exit(1);
  }

  // Get app name from package.json
  let appName = options?.appName ?? path.basename(projectRoot);
  if (!options?.appName) {
    try {
      const pkgPath = path.join(projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) {
        // Strip scope if present
        appName = pkg.name.replace(/^@[^/]+\//, '');
      }
    } catch {
      // Use directory name as fallback
    }
  }

  try {
    await run(remainingArgs, {
      commandsDir,
      projectRoot,
      appName,
      reporterAdapter: createReporterAdapter({ output: outputConfig }),
      prompter: createPrompter(),
    });
  } catch (error) {
    if (error instanceof RouterError) {
      process.exit(error.exitCode);
    }

    // Handle unexpected errors with clean messages
    const isDebug = process.env.DEBUG !== undefined;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isDebug) {
      // In debug mode, show full stack trace
      console.error('Error:', error);
    } else {
      // In normal mode, show clean error message
      console.error(`Error: ${errorMessage}`);
      console.error('\nSet DEBUG=1 for full stack trace.');
    }

    process.exit(1);
  }
}
