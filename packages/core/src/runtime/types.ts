/**
 * Type definitions for the runtime abstraction layer
 */

/**
 * Options for spawning a process
 */
export type SpawnOptions = {
  /** Working directory for the process */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string | undefined>;
  /** Standard I/O configuration */
  stdio?: 'inherit' | 'pipe' | ['inherit', 'inherit', 'inherit'] | ['inherit', 'pipe', 'pipe'];
};

/**
 * Result from a spawned process
 */
export type SpawnResult = {
  /** Process exit code */
  exitCode: number | null;
  /** Whether the process was killed */
  killed: boolean;
  /** Kill the process */
  kill(): void;
  /** Promise that resolves when the process exits */
  exited: Promise<number | null>;
  /** Standard output stream (if stdio is 'pipe') */
  stdout: ReadableStream<Uint8Array> | null;
  /** Standard error stream (if stdio is 'pipe') */
  stderr: ReadableStream<Uint8Array> | null;
};

/**
 * Options for shell command execution
 */
export type ShellOptions = {
  /** Working directory */
  cwd?: string;
  /** Environment variables to merge with process.env */
  env?: Record<string, string>;
  /** If true, suppress output */
  quiet?: boolean;
};

/**
 * Result from shell command execution
 */
export type ShellResult = {
  /** Exit code of the command */
  exitCode: number;
  /** Standard output text */
  stdout: string;
  /** Standard error text */
  stderr: string;
};

/**
 * Options for glob file matching
 */
export type GlobOptions = {
  /** Base directory to search in */
  cwd?: string;
};

/**
 * Runtime abstraction interface
 *
 * Provides a unified API for runtime-specific functionality that differs
 * between Bun and Node.js environments.
 */
export interface Runtime {
  /** Runtime name */
  readonly name: 'bun' | 'node';

  /**
   * Spawn a child process
   * @param cmd - Command to execute (array of arguments, first is the executable)
   * @param options - Spawn options
   */
  spawn(cmd: string[], options?: SpawnOptions): SpawnResult;

  /**
   * Execute a shell command and wait for completion
   * @param cmd - Shell command string
   * @param options - Shell options
   */
  shell(cmd: string, options?: ShellOptions): Promise<ShellResult>;

  /**
   * Execute a shell command using a template literal
   * Only available in Bun runtime, falls back to shell() in Node.js
   * @param cmd - Shell command string
   * @param options - Shell options
   */
  shellTemplate(cmd: string, options?: ShellOptions): Promise<ShellResult>;

  /**
   * Glob for files matching a pattern
   * @param pattern - Glob pattern (e.g., '*.ts', '**\/*.js')
   * @param options - Glob options
   */
  glob(pattern: string, options?: GlobOptions): AsyncIterable<string>;

  /**
   * Read a file as text
   * @param path - File path
   */
  readFile(path: string): Promise<string>;

  /**
   * Escape a string for safe use in shell commands
   * @param str - String to escape
   */
  escapeShell(str: string): string;
}
