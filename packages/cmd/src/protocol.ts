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
}

/**
 * The shape of the module exported by @pokit/core
 */
export interface ConfigModule {
  validateConfig(config: unknown, configPath: string): LauncherSkeleton;
}
