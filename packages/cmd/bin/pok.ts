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
import {
  DELEGATION_ENV,
  findProjectRoot,
  shouldDelegate,
  coreSupportsTerminalDefaults,
} from '../src/delegate';

const args = process.argv.slice(2);

// Step 0: Trampoline. If this project ships its own local `pokit` launcher that
// is a different installation from the one running now, re-exec it (with the
// same argv) and exit with its code. This keeps a project served entirely by
// the launcher version it pinned. Guarded against infinite recursion by the
// POK_DELEGATED env flag plus a same-install path check.
await maybeDelegate();

// Handle init before config discovery - must work without a config file
if (args[0] === 'init') {
  const { runInit } = await import('../src/init');
  await runInit();
  process.exit(0);
}

/**
 * Resolve the local `pokit` launcher entry from a directory, realpath-normalized.
 * Returns null when no local pokit is installed/resolvable.
 */
async function resolveLocalPokitEntry(fromDir: string): Promise<string | null> {
  try {
    const entry = await resolve('pokit', fromDir);
    return fs.realpathSync(entry);
  } catch {
    return null;
  }
}

/** The realpath of the currently-running launcher entry. */
function currentEntry(): string {
  try {
    return fs.realpathSync(import.meta.path);
  } catch {
    return import.meta.path;
  }
}

async function maybeDelegate(): Promise<void> {
  const delegated = process.env[DELEGATION_ENV] === '1';
  if (delegated) return;

  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) return;

  const localEntry = await resolveLocalPokitEntry(projectRoot);
  const debug = !!process.env.POK_DEBUG;

  if (!shouldDelegate({ delegated, localEntry, currentEntry: currentEntry() })) {
    if (debug) {
      console.error(
        `[pok] no delegation (running ${currentEntry()}, local=${localEntry ?? 'none'})`
      );
    }
    return;
  }

  if (debug) {
    console.error(`[pok] delegating to local launcher: ${localEntry}`);
  }

  const proc = Bun.spawnSync(['bun', localEntry!, ...args], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, [DELEGATION_ENV]: '1' },
  });
  process.exit(proc.exitCode ?? 0);
}

main().catch((err: unknown) => {
  if (err && typeof err === 'object' && 'exitCode' in err) {
    const code = Number((err as { exitCode?: unknown }).exitCode);
    process.exit(Number.isFinite(code) ? code : 1);
  }
  console.error(err);
  process.exit(1);
});

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
  let configModule = await resolveModule('@pokit/core', configDir);

  if (!configModule) {
    if (await ensureModulesInstalled(configDir, ['@pokit/core'])) {
      configModule = await resolveModule('@pokit/core', configDir);
    }
  }

  if (!configModule) {
    const installCmd = getInstallCommand(configDir, ['@pokit/core']);
    console.error(
      `Error: @pokit/core is not installed in ${configDir}\n\n` +
        'Install it with:\n' +
        `  ${installCmd}\n`
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

  // Step 5: Resolve default terminal UI for any UI surface the config omitted.
  const ui = await resolveTerminalDefaults(configDir, config, configModule);

  // Step 6: Import core and call runCli with config adapters
  // (In merged architecture, configModule and core are the same package)
  const { runCli } = configModule as any;

  await runCli(process.argv.slice(2), {
    commandsDir,
    projectRoot: cwd, // core uses projectRoot, config uses cwd
    appName: config.appName,
    version: config.version,
    reporterAdapter: config.reporter ?? ui?.reporter,
    prompter: config.prompter ?? ui?.prompter,
    navigator: config.navigator ?? ui?.navigator,
    pmScripts: config.pmScripts,
    pmCommands: config.pmCommands,
    plugins: config.plugins,
  });
}

/**
 * Resolve the default terminal UI (@pokit/terminal) when the config omits any
 * of the reporter/prompter/navigator surfaces. Returns null when the config
 * already provides both a reporter and a prompter (nothing to fill in).
 */
async function resolveTerminalDefaults(
  configDir: string,
  config: LauncherSkeleton,
  core: unknown
): Promise<{ reporter: unknown; prompter: unknown; navigator: unknown } | null> {
  // A navigator default is only meaningful when the resolved core actually
  // supports the navigator surface. An older core (pre zero-config) ignores it,
  // so we must not treat a missing navigator as a reason to pull in
  // @pokit/terminal — otherwise an explicit-adapter config on an old core would
  // needlessly resolve (and leak) the terminal package.
  const coreSupportsNavigator = coreSupportsTerminalDefaults(core);
  const needsNavigator = !config.navigator && coreSupportsNavigator;

  if (config.reporter && config.prompter && !needsNavigator) {
    return null;
  }

  let terminal = await resolveModule('@pokit/terminal', configDir);
  if (!terminal) {
    if (await ensureModulesInstalled(configDir, ['@pokit/terminal'])) {
      terminal = await resolveModule('@pokit/terminal', configDir);
    }
  }

  if (!terminal || typeof terminal.createTerminalUI !== 'function') {
    const installCmd = getInstallCommand(configDir, ['@pokit/terminal']);
    console.error(
      `Error: pok.config.ts omits a reporter/prompter and the default UI (@pokit/terminal) is not installed.\n\n` +
        `Install it with:\n  ${installCmd}\n\n` +
        `Or provide reporter and prompter explicitly in your config.`
    );
    process.exit(1);
  }

  return terminal.createTerminalUI();
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
 * Detect the package manager and workspace status.
 */
function getPMInfo(projectRoot: string): {
  name: 'npm' | 'pnpm' | 'yarn' | 'bun';
  isWorkspaceRoot: boolean;
} {
  let name: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';
  let isWorkspaceRoot = false;

  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    name = 'pnpm';
    if (fs.existsSync(path.join(projectRoot, 'pnpm-workspace.yaml'))) {
      isWorkspaceRoot = true;
    }
  } else if (
    fs.existsSync(path.join(projectRoot, 'bun.lockb')) ||
    fs.existsSync(path.join(projectRoot, 'bun.lock'))
  ) {
    name = 'bun';
    // Bun doesn't strictly require a flag for root, but we can detect it
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.workspaces) isWorkspaceRoot = true;
    } catch {}
  } else if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
    name = 'yarn';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.workspaces) isWorkspaceRoot = true;
    } catch {}
  } else {
    name = 'npm';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.workspaces) isWorkspaceRoot = true;
    } catch {}
  }

  return { name, isWorkspaceRoot };
}

/**
 * Generate the appropriate installation command for the detected PM.
 */
function getInstallCommand(pkgDir: string, moduleNames: string[]): string {
  const { name, isWorkspaceRoot } = getPMInfo(pkgDir);
  const modules = moduleNames.join(' ');

  switch (name) {
    case 'pnpm':
      return `pnpm add -D ${modules}${isWorkspaceRoot ? ' -w' : ''}`;
    case 'yarn':
      return `yarn add -D ${modules}${isWorkspaceRoot ? ' -W' : ''}`;
    case 'bun':
      return `bun add -d ${modules}`;
    case 'npm':
    default:
      return `npm install --save-dev ${modules}`;
  }
}

/**
 * Simple dependency-free Yes/No prompt.
 */
async function askYesNo(question: string): Promise<boolean> {
  if (!process.stdout.isTTY) return false;

  process.stdout.write(`${question} (Y/n) `);
  for await (const line of console) {
    const input = line.trim().toLowerCase();
    if (input === '' || input === 'y' || input === 'yes') return true;
    if (input === 'n' || input === 'no') return false;
    process.stdout.write('Please enter y or n: ');
  }
  return false;
}

/**
 * Ensure required pok modules are installed in the project.
 */
async function ensureModulesInstalled(pkgDir: string, moduleNames: string[]): Promise<boolean> {
  const { name: pm } = getPMInfo(pkgDir);
  const installCmd = getInstallCommand(pkgDir, moduleNames);

  const confirmed = await askYesNo(
    `Required pok modules (${moduleNames.join(', ')}) are missing locally. Install them with ${pm}?`
  );

  if (!confirmed) return false;

  console.log(`\nInstalling modules: ${installCmd}...\n`);

  try {
    const { $ } = await import('bun');
    await $`${{ raw: installCmd }}`.cwd(pkgDir);
    console.log('\nModules installed successfully!\n');
    return true;
  } catch (err) {
    console.error(
      `\nFailed to install modules: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

/**
 * Run pok in fallback mode when no config is found but package.json exists.
 */
async function runInFallbackMode(pkgDir: string) {
  let core = await resolveModule('@pokit/core', pkgDir);
  let terminal = await resolveModule('@pokit/terminal', pkgDir);

  if (!core || !terminal) {
    const missing = [];
    if (!core) missing.push('@pokit/core');
    if (!terminal) missing.push('@pokit/terminal');

    if (await ensureModulesInstalled(pkgDir, missing)) {
      // Retry resolution after installation
      core = await resolveModule('@pokit/core', pkgDir);
      terminal = await resolveModule('@pokit/terminal', pkgDir);
    }
  }

  if (!core || !terminal) {
    const installCmd = getInstallCommand(pkgDir, ['@pokit/core', '@pokit/terminal']);
    console.error(
      `Error: Required pok modules not found.\n\n` +
        `Install them in your project to enable the fallback menu:\n` +
        `  ${installCmd}\n\n` +
        `Or run \`pok init\` to bootstrap a configuration.`
    );
    process.exit(1);
  }

  const { runCli, defineCommand } = core;
  const { createTerminalUI } = terminal;
  const ui = createTerminalUI();
  const { runInit } = await import('../src/init');

  await runCli(process.argv.slice(2), {
    commandsDir: path.join(pkgDir, 'commands'),
    projectRoot: pkgDir,
    appName: path.basename(pkgDir),
    reporterAdapter: ui.reporter,
    prompter: ui.prompter,
    navigator: ui.navigator,
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
