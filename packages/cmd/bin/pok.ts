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
import type { ConfigModule, LauncherSkeleton } from '../src/protocol';

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

/**
 * Simple inline package.json search.
 */
function findPackageJsonSimple(startDir: string): { pkgPath: string; pkgDir: string } | null {
  let dir = startDir;

  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      return { pkgPath, pkgDir: dir };
    }

    const parentDir = path.dirname(dir);
    if (parentDir === dir) {
      return null;
    }
    dir = parentDir;
  }
}

/**
 * Try to resolve a module from the project directory, then from the launcher's own dependencies.
 */
async function resolveModule(name: string, configDir: string) {
  try {
    // 1. Try resolving from the project's node_modules
    const projectModulePath = await resolve(name, configDir);
    return await import(projectModulePath);
  } catch {
    try {
      // 2. Try resolving from the launcher's own dependencies
      return await import(name);
    } catch {
      return null;
    }
  }
}

/**
 * Run pok in fallback mode when no config is found but package.json exists.
 */
async function runInFallbackMode(pkgDir: string) {
  const core = await resolveModule('@pokit/core', pkgDir);
  const reporter = await resolveModule('@pokit/reporter-clack', pkgDir);
  const prompter = await resolveModule('@pokit/prompter-clack', pkgDir);

  if (!core || !reporter || !prompter) {
    console.error(
      `Error: Required pok modules not found.\n\n` +
        `Install them in your project to enable the fallback menu:\n` +
        `  bun add -d @pokit/core @pokit/reporter-clack @pokit/prompter-clack\n\n` +
        `Or run \`pok init\` to bootstrap a configuration.`
    );
    process.exit(1);
  }

  const { runCli, defineCommand } = core;
  const { createReporterAdapter } = reporter;
  const { createPrompter } = prompter;
  const { runInit } = await import('../src/init');

  await runCli(process.argv.slice(2), {
    commandsDir: path.join(pkgDir, 'commands'),
    projectRoot: pkgDir,
    appName: path.basename(pkgDir),
    reporterAdapter: createReporterAdapter(),
    prompter: createPrompter(),
    pmScripts: true,
    pmCommands: true,
    extraCommands: {
      init: defineCommand({
        label: 'init',
        description: 'Initialize pok config in this repo',
        run: async () => {
          await runInit();
        },
      }),
    },
  });
}

async function main() {
  const processCwd = process.cwd();

  // Step 1: Find config file using simple inline search
  const configResult = findConfigFileSimple(processCwd);

  if (!configResult) {
    // Look for package.json
    const pkgJsonResult = findPackageJsonSimple(processCwd);
    if (pkgJsonResult) {
      await runInFallbackMode(pkgJsonResult.pkgDir);
      return;
    }

    console.error(`Error: No pok configuration or package.json found.

Run \`pok init\` to create a pok.config.ts file.
`);
    process.exit(1);
  }

  const { configPath, configDir } = configResult;

  // Step 2: Dynamically resolve @pokit/core from the project directory
  const configModule = await resolveModule('@pokit/core', configDir);

  if (!configModule) {
    console.error(
      `Error: @pokit/core is not installed in ${configDir}\n\n` +
        'Install it with:\n' +
        '  bun add @pokit/core\n'
    );
    process.exit(1);
  }

  // Step 3: Load and validate config using the dynamically imported module
  let config: LauncherSkeleton;
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
    console.error(
      `The commandsDir path in ${configPath} resolves to a directory that doesn't exist.`
    );
    process.exit(1);
  }

  // Step 5: Import core and call runCli with config adapters
  // (In merged architecture, configModule and core are the same package)
  const { runCli } = configModule as any;

  await runCli(process.argv.slice(2), {
    commandsDir,
    projectRoot: cwd, // core uses projectRoot, config uses cwd
    appName: config.appName,
    version: config.version,
    reporterAdapter: config.reporter,
    prompter: config.prompter,
    tabs: config.tabs,
    pmScripts: config.pmScripts,
    pmCommands: config.pmCommands,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
