/**
 * Configuration Module
 *
 * This module provides configuration discovery, validation, and type definitions.
 * It implements the LauncherSkeleton defined by the pokit launcher.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { LauncherSkeleton } from 'pokit';
import type { EventBus } from '../events';
import type { Prompter } from '../prompter';
import type { TabsAdapter } from '../tabs';
import type { MountableLike } from '../lib/command';

export * from './prompter';
export * from './tabs';
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

  /** Directory containing command files, relative to appDir (defaults to './commands') */
  commandsDir?: string;

  /** App name for CLI display */
  appName?: string;

  /** Reporter adapter instance */
  reporter: ReporterAdapter;

  /** Prompter instance */
  prompter: Prompter;

  /** Optional tabs adapter instance */
  tabs?: TabsAdapter;

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
};

/**
 * pok configuration schema
 */
export const PokConfigSchema = z.object({
  appDir: z.string().optional(),
  cwd: z.string().optional(),
  commandsDir: z.string().optional(),
  appName: z.string().optional(),
  reporter: z.any(),
  prompter: z.any(),
  tabs: z.any().optional(),
  version: z.string().optional(),
  pmScripts: z.union([z.boolean(), z.array(z.string())]).optional(),
  pmCommands: z.union([z.boolean(), z.array(z.string())]).optional(),
  plugins: z.array(z.any()).optional(),
});

/**
 * Resolved configuration with all defaults applied.
 * This MUST satisfy the LauncherSkeleton defined in the pokit launcher.
 */
export interface ResolvedPokConfig extends LauncherSkeleton {
  appDir: string;
  cwd: string;
  commandsDir: string;
  appName?: string;
  version?: string;
  reporter: ReporterAdapter;
  prompter: Prompter;
  tabs?: TabsAdapter;
  pmScripts?: boolean | string[];
  pmCommands?: boolean | string[];
  plugins?: MountableLike[];
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

  const result = PokConfigSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${configPath}:\n${issues}`);
  }

  const cfg = result.data;

  return {
    appDir: '.',
    cwd: '.',
    commandsDir: './commands',
    ...cfg,
  } as ResolvedPokConfig;
}

/**
 * Template string for scaffolding new pok.config.ts files.
 * Points to @pokit/core now.
 */
export const CONFIG_TEMPLATE = `import { defineConfig } from '@pokit/core'
import { createReporterAdapter } from '@pokit/reporter-clack'
import { createPrompter } from '@pokit/prompter-clack'

export default defineConfig({
  reporter: createReporterAdapter(),
  prompter: createPrompter(),
})
`;
