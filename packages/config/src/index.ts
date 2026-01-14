/**
 * @pokit/config - Configuration types and utilities for pok
 *
 * This module provides configuration discovery, validation, and type definitions
 * for pok projects.
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Adapter Type Contracts
// =============================================================================

/**
 * Minimal structural type for reporter adapters.
 * Full behavioral contract defined in @pokit/core.
 */
export interface ReporterAdapter {
  start(bus: unknown): { stop(): void };
}

/**
 * Minimal structural type for prompter adapters.
 * Full behavioral contract defined in @pokit/core.
 */
export interface Prompter {
  select<T>(options: { message: string; options: Array<{ value: T; label: string }> }): Promise<T>;
  multiselect<T>(options: {
    message: string;
    options: Array<{ value: T; label: string }>;
  }): Promise<T[]>;
  confirm(options: { message: string }): Promise<boolean>;
  text(options: { message: string }): Promise<string>;
}

/**
 * Minimal structural type for tabs adapters.
 * Full behavioral contract defined in @pokit/core.
 */
export interface TabsAdapter {
  run(
    items: Array<{ label: string; exec: string }>,
    options: { name: string; cwd: string; env: Record<string, string | undefined> }
  ): Promise<void>;
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
};

/**
 * Resolved configuration with all defaults applied
 */
export type ResolvedPokConfig = Required<Pick<PokConfig, 'appDir' | 'cwd' | 'commandsDir'>> &
  Omit<PokConfig, 'appDir' | 'cwd' | 'commandsDir'>;

/**
 * Identity function for type inference in config files
 *
 * @example
 * import { defineConfig } from '@pokit/config'
 * import { createReporterAdapter } from '@pokit/reporter-clack'
 * import { createPrompter } from '@pokit/prompter-clack'
 *
 * export default defineConfig({
 *   reporter: createReporterAdapter(),
 *   prompter: createPrompter(),
 * })
 */
export function defineConfig(config: PokConfig): PokConfig {
  return config;
}

/**
 * Search for a config file starting from the given directory,
 * walking up the directory tree until found or reaching root.
 *
 * @returns Path to config file and the directory it was found in, or null if not found
 */
export function findConfigFile(startDir: string): { configPath: string; configDir: string } | null {
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
 * Validate required config fields, apply defaults, and return resolved config
 */
export function validateConfig(config: unknown, configPath: string): ResolvedPokConfig {
  if (!config || typeof config !== 'object') {
    throw new Error(
      `Invalid configuration in ${configPath}\n\n` + 'The config file must export a default object.'
    );
  }

  const cfg = config as Record<string, unknown>;

  // Check required fields
  if (!cfg.reporter) {
    throw new Error(
      `reporter is required in ${configPath}\n\n` +
        'Example configuration:\n\n' +
        `  import { defineConfig } from '@pokit/config'\n` +
        `  import { createReporterAdapter } from '@pokit/reporter-clack'\n` +
        `  import { createPrompter } from '@pokit/prompter-clack'\n\n` +
        `  export default defineConfig({\n` +
        `    reporter: createReporterAdapter(),\n` +
        `    prompter: createPrompter(),\n` +
        `  })\n`
    );
  }

  if (!cfg.prompter) {
    throw new Error(
      `prompter is required in ${configPath}\n\n` +
        'Example configuration:\n\n' +
        `  import { defineConfig } from '@pokit/config'\n` +
        `  import { createReporterAdapter } from '@pokit/reporter-clack'\n` +
        `  import { createPrompter } from '@pokit/prompter-clack'\n\n` +
        `  export default defineConfig({\n` +
        `    reporter: createReporterAdapter(),\n` +
        `    prompter: createPrompter(),\n` +
        `  })\n`
    );
  }

  // Apply defaults
  return {
    appDir: '.',
    cwd: '.',
    commandsDir: './commands',
    ...cfg,
  } as ResolvedPokConfig;
}

/**
 * Template string for scaffolding new pok.config.ts files
 */
export const CONFIG_TEMPLATE = `import { defineConfig } from '@pokit/config'
import { createReporterAdapter } from '@pokit/reporter-clack'
import { createPrompter } from '@pokit/prompter-clack'

export default defineConfig({
  reporter: createReporterAdapter(),
  prompter: createPrompter(),
})
`;
