/**
 * @pokit/config - Configuration types and utilities for pok
 *
 * This module provides configuration discovery, validation, and type definitions
 * for pok projects.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * pok configuration schema
 */
export type PokConfig = {
  /** Directory containing command files - REQUIRED */
  commandsDir: string;

  /** Project root for running shell commands (defaults to config file directory) */
  projectRoot?: string;

  /** App name for CLI display */
  appName?: string;

  /** Reporter adapter package name, e.g. '@pokit/reporter-clack' */
  reporterAdapter: string;

  /** Prompter package name, e.g. '@pokit/prompter-clack' */
  prompter: string;

  /** Tabs adapter package name, e.g. '@pokit/tabs-ink' */
  tabs?: string;

  /** Version string for --version flag */
  version?: string;
};

/**
 * Identity function for type inference in config files
 *
 * @example
 * export default defineConfig({
 *   commandsDir: './commands',
 *   reporterAdapter: '@pokit/reporter-clack',
 *   prompter: '@pokit/prompter-clack',
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
 * Validate required config fields and return clear error messages
 */
export function validateConfig(config: unknown, configPath: string): PokConfig {
  if (!config || typeof config !== 'object') {
    throw new Error(
      `Invalid configuration in ${configPath}\n\n` +
      'The config file must export a default object.'
    );
  }

  const cfg = config as Record<string, unknown>;

  // Check required fields
  const requiredFields = ['commandsDir', 'reporterAdapter', 'prompter'] as const;
  for (const field of requiredFields) {
    if (!cfg[field]) {
      throw new Error(
        `${field} is required in ${configPath}\n\n` +
        'Example configuration:\n\n' +
        `  import { defineConfig } from '@pokit/config'\n\n` +
        `  export default defineConfig({\n` +
        `    commandsDir: './commands',\n` +
        `    reporterAdapter: '@pokit/reporter-clack',\n` +
        `    prompter: '@pokit/prompter-clack',\n` +
        `  })\n`
      );
    }
  }

  return cfg as unknown as PokConfig;
}

/**
 * Template string for scaffolding new pok.config.ts files
 */
export const CONFIG_TEMPLATE = `import { defineConfig } from 'pokit'

export default defineConfig({
  commandsDir: './commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
})
`;
