/**
 * Bun runtime implementation
 *
 * Uses native Bun APIs for optimal performance:
 * - Bun.spawn() for process spawning
 * - Bun.$ for shell commands
 * - Bun.Glob for file globbing
 * - Bun.file() for file reading
 */

import type { Runtime, SpawnOptions, SpawnResult, ShellOptions, ShellResult, GlobOptions } from './types';

/**
 * Create a Bun runtime implementation
 */
export function createBunRuntime(): Runtime {
  // Dynamic import to avoid issues when loaded in Node.js
  // These are resolved at runtime in Bun
  const BunGlob = (globalThis as any).Bun.Glob;
  const BunSpawn = (globalThis as any).Bun.spawn;
  const BunFile = (globalThis as any).Bun.file;
  const BunShell = (globalThis as any).Bun.$;

  const spawn = (cmd: string[], options?: SpawnOptions): SpawnResult => {
    const stdio = normalizeStdio(options?.stdio);

    const proc = BunSpawn(cmd, {
      cwd: options?.cwd,
      env: options?.env,
      stdio,
    });

    return {
      get exitCode() {
        return proc.exitCode;
      },
      get killed() {
        return proc.killed;
      },
      kill() {
        proc.kill();
      },
      get exited() {
        return proc.exited;
      },
      get stdout() {
        return proc.stdout;
      },
      get stderr() {
        return proc.stderr;
      },
    };
  };

  const shell = async (cmd: string, options?: ShellOptions): Promise<ShellResult> => {
    const env = options?.env ? { ...process.env, ...options.env } : process.env;

    // Use Bun's shell with raw template to avoid double escaping
    let result;
    if (options?.cwd) {
      result = await BunShell`${{ raw: cmd }}`.env(env).cwd(options.cwd).nothrow().quiet();
    } else {
      result = await BunShell`${{ raw: cmd }}`.env(env).nothrow().quiet();
    }

    return {
      exitCode: result.exitCode,
      stdout: result.text(),
      stderr: result.stderr?.toString() ?? '',
    };
  };

  const shellTemplate = async (cmd: string, options?: ShellOptions): Promise<ShellResult> => {
    // For Bun, shellTemplate works the same as shell
    return shell(cmd, options);
  };

  async function* glob(pattern: string, options?: GlobOptions): AsyncIterable<string> {
    const g = new BunGlob(pattern);
    const cwd = options?.cwd ?? process.cwd();
    for await (const file of g.scan(cwd)) {
      yield file;
    }
  }

  const readFile = async (path: string): Promise<string> => {
    const file = BunFile(path);
    return file.text();
  };

  const escapeShell = (str: string): string => {
    // Use Bun's native escape function
    return BunShell.escape(str);
  };

  return {
    name: 'bun',
    spawn,
    shell,
    shellTemplate,
    glob,
    readFile,
    escapeShell,
  };
}

/**
 * Normalize stdio option to Bun's expected format
 */
function normalizeStdio(
  stdio?: SpawnOptions['stdio']
): ['inherit', 'inherit', 'inherit'] | ['inherit', 'pipe', 'pipe'] {
  if (!stdio) {
    return ['inherit', 'inherit', 'inherit'];
  }
  if (stdio === 'inherit') {
    return ['inherit', 'inherit', 'inherit'];
  }
  if (stdio === 'pipe') {
    return ['inherit', 'pipe', 'pipe'];
  }
  return stdio;
}
