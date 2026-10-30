/**
 * Configuration Module
 *
 * This module provides configuration discovery, validation, and type definitions.
 * It implements the LauncherSkeleton defined by the pokit launcher.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LauncherSkeleton } from 'pokit';
import type { EventBus } from '../events';
import type { Prompter, Navigator } from '../prompter';
import type { MountableLike } from '../lib/command';
import { themeSpecIssues, type ThemeSpec } from '../theme-spec';
import { issuePath, type StandardSchemaV1 } from '../lib/schema';

export * from './prompter';
export * from './events';

// =============================================================================
// Adapter Type Contracts
// =============================================================================

/**
 * Controller returned by ReporterAdapter.start()
 */
export interface ReporterAdapterController {
  /**
   * Stop the adapter and clean up resources.
   */
  stop(): void;
}

/**
 * Reporter Adapter Interface
 */
export interface ReporterAdapter {
  /**
   * Start listening to the EventBus and rendering output.
   *
   * @param bus - The EventBus to subscribe to
   * @returns Controller object with stop() method to clean up
   */
  start(bus: EventBus): ReporterAdapterController;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * pok configuration schema
 */
export type PokConfig = {
  /** Root directory of the pok CLI app, where packages are resolved from (defaults to '.') */
  appDir?: string;

  /** Working directory for running commands (defaults to '.') */
  cwd?: string;

  /**
   * Directory containing command files, relative to appDir.
   * Omitted: still looks for `./commands` when that directory exists. A missing
   * implicit default is silent if plugins/scripts mount commands; an empty
   * composed tree is an error. An explicit path that does not exist is warned.
   */
  commandsDir?: string;

  /** App name for CLI display */
  appName?: string;

  /**
   * Reporter adapter instance.
   * Optional — when omitted, the launcher wires in @pokit/terminal's default.
   */
  reporter?: ReporterAdapter;

  /**
   * Prompter instance.
   * Optional — when omitted, the launcher wires in @pokit/terminal's default.
   */
  prompter?: Prompter;

  /**
   * Navigator instance (menu presentation policy).
   * Optional — when omitted, the launcher wires in @pokit/terminal's default.
   */
  navigator?: Navigator;

  /** Version string for --version flag */
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
   * Plugins to mount at the root.
   * Allows injecting dynamic command sources.
   */
  plugins?: MountableLike[];

  /**
   * Theme for the default terminal UI (preset, glyph and colour overrides).
   * Ignored when reporter/prompter instances are supplied explicitly.
   */
  theme?: ThemeSpec;
};

const STRING_FIELDS = ['appDir', 'cwd', 'commandsDir', 'appName', 'version'] as const;
const SCRIPT_FIELDS = ['pmScripts', 'pmCommands'] as const;

function configIssues(config: Record<string, unknown>): StandardSchemaV1.Issue[] {
  const issues: StandardSchemaV1.Issue[] = [];
  for (const key of STRING_FIELDS) {
    if (config[key] !== undefined && typeof config[key] !== 'string') {
      issues.push({ message: 'Expected string', path: [key] });
    }
  }
  for (const key of SCRIPT_FIELDS) {
    const v = config[key];
    if (
      v !== undefined &&
      typeof v !== 'boolean' &&
      !(Array.isArray(v) && v.every((s) => typeof s === 'string'))
    ) {
      issues.push({ message: 'Expected boolean or string[]', path: [key] });
    }
  }
  if (config.plugins !== undefined && !Array.isArray(config.plugins)) {
    issues.push({ message: 'Expected array', path: ['plugins'] });
  }
  if (config.theme !== undefined) {
    for (const issue of themeSpecIssues(config.theme)) {
      issues.push({ ...issue, path: ['theme', ...(issue.path ?? [])] });
    }
  }
  return issues;
}

/**
 * Resolved configuration with all defaults applied.
 * This MUST satisfy the LauncherSkeleton defined in the pokit launcher.
 */
export interface ResolvedPokConfig extends LauncherSkeleton {
  appDir: string;
  cwd: string;
  commandsDir?: string;
  appName?: string;
  version?: string;
  reporter?: ReporterAdapter;
  prompter?: Prompter;
  navigator?: Navigator;
  pmScripts?: boolean | string[];
  pmCommands?: boolean | string[];
  plugins?: MountableLike[];
  theme?: ThemeSpec;
}

/**
 * Identity function for type inference in config files
 */
export function defineConfig(config: PokConfig): PokConfig {
  return config;
}

/**
 * Search for a config file starting from the given directory,
 * walking up the directory tree until found or reaching root.
 */
export function findConfigFile(startDir: string): { configPath: string; configDir: string } | null {
  let dir = startDir;

  while (true) {
    const configPath = path.join(dir, 'pok.config.ts');
    if (fs.existsSync(configPath)) {
      return { configPath, configDir: dir };
    }

    const dotConfigPath = path.join(dir, '.config', 'pok.config.ts');
    if (fs.existsSync(dotConfigPath)) {
      return { configPath: dotConfigPath, configDir: dir };
    }

    const parentDir = path.dirname(dir);
    if (parentDir === dir) {
      return null;
    }
    dir = parentDir;
  }
}

/**
 * Validate required config fields, apply defaults, and return resolved config
 */
export function validateConfig(config: unknown, configPath: string): ResolvedPokConfig {
  if (!config || typeof config !== 'object') {
    throw new Error(
      `Invalid configuration in ${configPath}\n\n` + 'The config file must export a default object.'
    );
  }

  const issues = configIssues(config as Record<string, unknown>);

  if (issues.length > 0) {
    const lines = issues.map((i) => `  - ${issuePath(i)}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration in ${configPath}:\n${lines}`);
  }

  const cfg = config as PokConfig;

  // commandsDir has no hard default: omitted still probes './commands' when
  // present. A missing implicit default is silent if other mountables fill the
  // tree; emptiness is an error at compose time.
  return {
    appDir: '.',
    cwd: '.',
    ...cfg,
  } as ResolvedPokConfig;
}

/**
 * Template string for scaffolding new pok.config.ts files.
 *
 * Zero-config by default: the pok launcher wires in the default terminal UI
 * (@pokit/terminal) when reporter/prompter/navigator are omitted. Spread
 * `createTerminalUI(options)` only when passing options.
 */
export const CONFIG_TEMPLATE = `import { defineConfig } from '@pokit/core'

export default defineConfig({
  pmScripts: true,
})
`;
