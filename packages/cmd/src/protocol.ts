/**
 * The Pokit Launcher Protocol
 *
 * This file defines the "Skeleton" that any pok configuration must satisfy
 * for the global launcher to successfully bootstrap the application.
 *
 * This is the "Master" contract.
 */

export interface LauncherSkeleton {
  /** Root directory of the pok CLI app */
  appDir: string;
  /** Working directory for running commands */
  cwd: string;
  /** Directory containing command files */
  commandsDir: string;
  /** App name for CLI display */
  appName?: string;
  /** Version string */
  version?: string;
  /** Reporter adapter instance */
  reporter: any;
  /** Prompter instance */
  prompter: any;
  /** Optional tabs adapter instance */
  tabs?: any;
  /** NPM scripts configuration */
  npmScripts?: boolean | string[];
}

/**
 * The shape of the module exported by @pokit/core
 */
export interface ConfigModule {
  validateConfig(config: unknown, configPath: string): LauncherSkeleton;
}
