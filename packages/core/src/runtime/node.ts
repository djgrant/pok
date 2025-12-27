/**
 * Node.js runtime implementation
 *
 * Uses Node.js native APIs and compatible libraries:
 * - node:child_process spawn for process spawning
 * - node:child_process exec for shell commands
 * - fast-glob for file globbing
 * - node:fs/promises for file reading
 */

import { spawn as nodeSpawn, exec as nodeExec } from 'node:child_process';
import { readFile as fsReadFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { Runtime, SpawnOptions, SpawnResult, ShellOptions, ShellResult, GlobOptions } from './types';

const execAsync = promisify(nodeExec);

/**
 * Create a Node.js runtime implementation
 */
export function createNodeRuntime(): Runtime {
  const spawn = (cmd: string[], options?: SpawnOptions): SpawnResult => {
    const [command, ...args] = cmd;
    if (!command) {
      throw new Error('spawn requires at least one command argument');
    }

    const stdio = normalizeStdio(options?.stdio);

    const proc = nodeSpawn(command, args, {
      cwd: options?.cwd,
      env: options?.env as NodeJS.ProcessEnv,
      stdio,
    });

    let _exitCode: number | null = null;
    let _killed = false;

    const exitedPromise = new Promise<number | null>((resolve) => {
      proc.on('exit', (code) => {
        _exitCode = code;
        resolve(code);
      });
      proc.on('error', () => {
        resolve(null);
      });
    });

    // Convert Node.js streams to web streams if available
    let stdout: ReadableStream<Uint8Array> | null = null;
    let stderr: ReadableStream<Uint8Array> | null = null;

    if (proc.stdout && stdio[1] === 'pipe') {
      stdout = nodeStreamToWebStream(proc.stdout);
    }
    if (proc.stderr && stdio[2] === 'pipe') {
      stderr = nodeStreamToWebStream(proc.stderr);
    }

    return {
      get exitCode() {
        return _exitCode;
      },
      get killed() {
        return _killed || proc.killed;
      },
      kill() {
        _killed = true;
        proc.kill();
      },
      get exited() {
        return exitedPromise;
      },
      get stdout() {
        return stdout;
      },
      get stderr() {
        return stderr;
      },
    };
  };

  const shell = async (cmd: string, options?: ShellOptions): Promise<ShellResult> => {
    const env = options?.env ? { ...process.env, ...options.env } : process.env;

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: options?.cwd,
        env: env as NodeJS.ProcessEnv,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });

      return {
        exitCode: 0,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      };
    } catch (error: any) {
      // exec throws on non-zero exit code
      return {
        exitCode: error.code ?? 1,
        stdout: error.stdout?.toString() ?? '',
        stderr: error.stderr?.toString() ?? '',
      };
    }
  };

  const shellTemplate = async (cmd: string, options?: ShellOptions): Promise<ShellResult> => {
    // Node.js doesn't have Bun's shell template, use regular shell
    return shell(cmd, options);
  };

  async function* glob(pattern: string, options?: GlobOptions): AsyncIterable<string> {
    // Dynamically import fast-glob to avoid bundling issues
    const fgModule = await import('fast-glob');
    const cwd = options?.cwd ?? process.cwd();

    // fast-glob returns an array, yield each item
    const files = await fgModule.glob(pattern, {
      cwd,
      dot: false,
      onlyFiles: true,
    });

    for (const file of files) {
      yield file;
    }
  }

  const readFile = async (path: string): Promise<string> => {
    return fsReadFile(path, 'utf-8');
  };

  const escapeShell = (str: string): string => {
    // POSIX shell escaping - wrap in single quotes and escape existing single quotes
    return `'${str.replace(/'/g, "'\\''")}'`;
  };

  return {
    name: 'node',
    spawn,
    shell,
    shellTemplate,
    glob,
    readFile,
    escapeShell,
  };
}

/**
 * Normalize stdio option to Node.js expected format
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

/**
 * Convert a Node.js Readable stream to a Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer | string) => {
        if (typeof chunk === 'string') {
          controller.enqueue(new TextEncoder().encode(chunk));
        } else {
          controller.enqueue(new Uint8Array(chunk));
        }
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', (err) => {
        controller.error(err);
      });
    },
    cancel() {
      if ('destroy' in nodeStream && typeof nodeStream.destroy === 'function') {
        nodeStream.destroy();
      }
    },
  });
}
