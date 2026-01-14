#!/usr/bin/env bun
/**
 * pokit - Global CLI launcher for pok
 *
 * This is the global CLI entry point that:
 * 1. Searches for pok.config.ts (or .config/pok.config.ts) starting from cwd
 * 2. Loads and validates the config
 * 3. Resolves paths relative to config file location
 * 4. Calls runCli() with the config
 *
 * Install globally with: bun add -g pokit
 * Then run `pok` from any project with a pok.config.ts file.
 */

import { resolve } from 'bun';
import * as fs from 'fs';
import * as path from 'path';

// Handle init before config discovery - must work without a config file
const args = process.argv.slice(2);
if (args[0] === 'init') {
  const { runInit } = await import('../src/init');
  await runInit();
  process.exit(0);
}

/**
 * Simple inline config file search (no external dependencies).
 * Searches for pok.config.ts starting from startDir, walking up the tree.
 */
function findConfigFileSimple(startDir: string): { configPath: string; configDir: string } | null {
  let dir = startDir;

  while (true) {
    // Check for pok.config.ts in current directory
    const configPath = path.join(dir, 'pok.config.ts');
    if (fs.existsSync(configPath)) {
      return { configPath, configDir: dir };
    }

    // Check for .config/pok.config.ts
    const dotConfigPath = path.join(dir, '.config', 'pok.config.ts');
    if (fs.existsSync(dotConfigPath)) {
      return { configPath: dotConfigPath, configDir: dir };
    }

    // Move up to parent directory
    const parentDir = path.dirname(dir);
    if (parentDir === dir) {
      // Reached filesystem root
      return null;
    }
    dir = parentDir;
  }
}

async function main() {
  const processCwd = process.cwd();

  // Step 1: Find config file using simple inline search
  const configResult = findConfigFileSimple(processCwd);

  if (!configResult) {
    console.error(`Error: No pok configuration found.

Run \`pok init\` to create a pok.config.ts file.
`);
    process.exit(1);
  }

  const { configPath, configDir } = configResult;

  // Step 2: Dynamically resolve @pokit/config from the project directory
  let configModule: {
    validateConfig: (
      config: unknown,
      configPath: string
    ) => {
      appDir: string;
      cwd: string;
      commandsDir: string;
      appName?: string;
      reporter: unknown;
      prompter: unknown;
      tabs?: unknown;
      version?: string;
    };
  };

  try {
    const configModulePath = await resolve('@pokit/config', configDir);
    configModule = await import(configModulePath);
  } catch {
    console.error(
      `Error: @pokit/config is not installed in ${configDir}\n\n` +
        'Install it with:\n' +
        '  bun add @pokit/config\n'
    );
    process.exit(1);
  }

  // Step 3: Load and validate config using the dynamically imported module
  let config: ReturnType<typeof configModule.validateConfig>;
  try {
    const rawConfig = await import(configPath);
    config = configModule.validateConfig(rawConfig.default, configPath);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to load config from ${configPath}\n`);
    console.error(errorMessage);
    process.exit(1);
  }

  // Step 4: Resolve paths relative to config file location
  // appDir is relative to configDir, commandsDir is relative to appDir
  const appDir = path.resolve(configDir, config.appDir);
  const commandsDir = path.resolve(appDir, config.commandsDir);
  const cwd = path.resolve(configDir, config.cwd);

  // Verify commands directory exists
  if (!fs.existsSync(commandsDir)) {
    console.error(`Error: Commands directory not found: ${commandsDir}\n`);
    console.error(`The commandsDir path in ${configPath} resolves to a directory that doesn't exist.`);
    process.exit(1);
  }

  // Step 5: Resolve @pokit/core from appDir (where packages are installed)
  let corePath: string;
  try {
    corePath = await resolve('@pokit/core', appDir);
  } catch {
    console.error(
      `Error: @pokit/core is not installed in ${appDir}\n\n` +
        'Install it with:\n' +
        '  bun add @pokit/core\n'
    );
    process.exit(1);
  }

  // Step 6: Import core and call runCli with config adapters
  const { runCli } = await import(corePath);

  await runCli(process.argv.slice(2), {
    commandsDir,
    projectRoot: cwd, // core uses projectRoot, config uses cwd
    appName: config.appName,
    version: config.version,
    reporterAdapter: config.reporter,
    prompter: config.prompter,
    tabs: config.tabs,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
