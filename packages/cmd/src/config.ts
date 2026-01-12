/**
 * pok configuration types and utilities
 *
 * This module provides the PokConfig type and defineConfig function
 * for creating type-safe pok configuration files.
 *
 * Usage:
 *   // pok.config.ts
 *   import { defineConfig } from 'pokit'
 *
 *   export default defineConfig({
 *     commandsDir: './commands',
 *     reporterAdapter: '@pokit/reporter-clack',
 *     prompter: '@pokit/prompter-clack',
 *   })
 */

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
