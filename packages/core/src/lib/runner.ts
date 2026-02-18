import {
  type AnyTaskConfig,
  type ExecTaskConfig,
  type RunTaskConfig,
  type TaskContext,
  type ExecInput,
  type RetryConfig,
  isShellPromise,
  execInputToString,
} from './task';
import { type Env, getEnvKeys } from './env';
import { getRuntime, type SpawnResult } from '../runtime';
import type { TabsAdapter, TabSpec, AppAdapter, AnyComponent } from '../tabs';
import type { EventBus, Reporter, CommandReporter, GroupOptions } from '../events';
import { ScopedReporter } from '../events';
import type { Prompter } from '../prompter';

type AnyEnv = Env<any, any>;

export type ExecOptions = {
  timeout?: number;
  /**
   * Retry configuration for this command.
   * When specified, failed executions will be retried according to this config.
   */
  retry?: RetryConfig;
  /**
   * Run command with full stdio inheritance for interactive prompts.
   * Use this when the command needs user input (e.g., browser auth, OTP prompts).
   * Output won't be captured - it goes directly to the terminal.
   */
  interactive?: boolean;
  /**
   * Working directory for this command.
   * If not specified, uses the runner's default CWD.
   */
  cwd?: string;
  /**
   * Environment variables to set for this command.
   * Set a value to `undefined` to unset it from the inherited environment.
   */
  env?: Record<string, string | undefined>;
};

/**
 * Error thrown when a command is aborted via AbortSignal
 */
export class AbortError extends Error {
  constructor(message: string = 'Command aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * Error thrown when a command times out.
 * Provides actionable information including command name, timeout duration, and suggestions.
 */
export class TimeoutError extends Error {
  /** The command that timed out */
  readonly command: string;
  /** The timeout duration in milliseconds */
  readonly timeoutMs: number;

  constructor(command: string, timeoutMs: number) {
    const timeoutSecs = Math.round(timeoutMs / 1000);
    const message =
      `Command timed out after ${timeoutSecs}s: ${command}\n\n` +
      `Suggestions:\n` +
      `  - Increase the timeout in your command config\n` +
      `  - Check if the command is hanging or waiting for input\n` +
      `  - Run the command manually to debug`;
    super(message);
    this.name = 'TimeoutError';
    this.command = command;
    this.timeoutMs = timeoutMs;
  }
}

export type Command = {
  readonly _type: 'command';
  readonly cmd: ExecInput;
  readonly opts?: ExecOptions;
  then<T = void, R = never>(
    onFulfilled?: ((value: void) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null
  ): Promise<T | R>;
};

function isCommand(item: unknown): item is Command {
  return (
    typeof item === 'object' &&
    item !== null &&
    '_type' in item &&
    (item as Command)._type === 'command'
  );
}

/**
 * A deferred task that can be awaited or passed to r.tabs().
 * Created via r.run() - implements thenable interface for direct await.
 */
export type DeferredTask<TReturn = void> = {
  readonly _type: 'deferred-task';
  readonly task: AnyTaskConfig;
  readonly params?: Record<string, unknown>;
  then<T = TReturn, R = never>(
    onFulfilled?: ((value: TReturn) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null
  ): Promise<T | R>;
};

function isDeferredTask(item: unknown): item is DeferredTask<unknown> {
  return (
    typeof item === 'object' &&
    item !== null &&
    '_type' in item &&
    (item as DeferredTask)._type === 'deferred-task'
  );
}

/** Items that can be passed to r.parallel() or r.tabs() */
export type RunnerItem = Command | DeferredTask<unknown>;

// =============================================================================
// Parallel Execution Options
// =============================================================================

/**
 * Parallel execution mode constants with descriptions.
 */
export const ParallelModes = {
  /**
   * First to settle (success or failure) wins, cancel rest.
   * Use for long-running processes where you only need one.
   * @example `await r.parallel([r.exec('vite'), r.exec('stripe listen')])`
   */
  race: 'race',
  /**
   * First failure cancels rest, otherwise wait for all to succeed.
   * Use when all tasks must succeed but you want fast failure.
   * @example `await r.parallel([r.run(build), r.run(test)], { mode: 'fail-fast' })`
   */
  failFast: 'fail-fast',
  /**
   * Run all to completion regardless of failures.
   * Throws AggregateError if any fail.
   * @example `await r.parallel([r.run(deploy1), r.run(deploy2)], { mode: 'all-settled' })`
   */
  allSettled: 'all-settled',
} as const;

/**
 * Parallel execution mode.
 * - `'race'`: First to settle wins, cancel rest (default)
 * - `'fail-fast'`: First failure cancels rest, otherwise wait for all
 * - `'all-settled'`: Run all to completion, throw AggregateError if any fail
 */
export type ParallelMode = (typeof ParallelModes)[keyof typeof ParallelModes];

/**
 * Options for parallel execution.
 */
export type ParallelOptions = {
  /**
   * Execution mode for the parallel group.
   *
   * - `'race'`: First to settle wins, cancel rest (default)
   * - `'fail-fast'`: First failure cancels rest, otherwise wait for all
   * - `'all-settled'`: Run all to completion, throw AggregateError if any fail
   *
   * @default 'race'
   */
  mode?: ParallelMode;
};

/**
 * Options for the tabs runner.
 */
export type TabsRunnerOptions = {
  /** Name shown in console messages (e.g., "Opening {name} console...") */
  name?: string;
};

/**
 * Runner interface for executing commands and tasks within a command's run function.
 *
 * @typeParam _TContext - The context type parameter is used for type inference at the
 * command definition level. While not directly used in Runner methods, it enables
 * type-safe context passing through the command execution chain. The underscore prefix
 * indicates this is a phantom type parameter - it exists solely for type-level
 * information and does not affect runtime behavior.
 */
export interface Runner<_TContext extends Record<string, unknown> = Record<string, unknown>> {
  cwd: string;

  /**
   * Reporter for event-driven output.
   * Use this to emit events for logging and sectioning.
   */
  reporter: CommandReporter;

  /**
   * Prompter for interactive user input.
   * Use this for select, multiselect, confirm, and text prompts.
   * In tests, this can be replaced with createRawPrompter() for non-interactive testing.
   */
  prompter: Prompter;

  /**
   * Execute a command. Supports three forms:
   * - string: Passed to sh -c (for static commands)
   * - string[]: Array of arguments, bypasses shell (safe for dynamic input)
   * - $.ShellPromise: Bun shell template (provides automatic escaping)
   *
   * @example
   * await r.exec('npm run build');
   * await r.exec(['git', 'checkout', branch]);  // Safe with dynamic input
   * await r.exec($`git checkout ${branch}`);     // Bun shell escaping
   */
  exec(cmd: ExecInput, opts?: ExecOptions): Command;

  /**
   * Run multiple commands or tasks in parallel.
   *
   * Modes:
   * - 'race' (default): First to settle wins, cancel rest
   * - 'fail-fast': First failure cancels rest, otherwise wait for all
   * - 'all-settled': Run all to completion, throw AggregateError if any fail
   *
   * Tasks with retry configs will retry before the parallel mode rules apply.
   *
   * @example
   * // Race mode (default) - first to complete wins
   * await r.parallel([r.exec('vite'), r.exec('stripe listen')]);
   *
   * // Fail-fast mode - all must succeed
   * await r.parallel([r.run(task1), r.run(task2)], { mode: 'fail-fast' });
   *
   * // All-settled mode - run all regardless of failures
   * await r.parallel([r.run(task1), r.run(task2)], { mode: 'all-settled' });
   */
  parallel(items: RunnerItem[], options?: ParallelOptions): Promise<void>;

  /**
   * Run multiple commands or tasks in a tabbed terminal interface.
   * Each tab shows the buffered output of its process.
   * User can switch tabs and scroll through output.
   *
   * Accepts commands (r.exec) or deferred tasks (r.run).
   * Task envs are resolved before spawning processes.
   *
   * @example
   * // With tasks
   * await r.tabs([r.run(startViteDev), r.run(startStripeListener)]);
   *
   * // With commands
   * await r.tabs([r.exec('vite'), r.exec('stripe listen')]);
   *
   * // Mixed
   * await r.tabs([r.run(startViteDev), r.exec('stripe listen')]);
   *
   * // With custom name
   * await r.tabs([...], { name: 'Development' });
   */
  tabs(items: RunnerItem[], options?: TabsRunnerOptions): Promise<void>;

  /**
   * Run a fullscreen interactive app.
   * The component receives props and owns its own state via React hooks.
   * The adapter handles terminal lifecycle (alternate screen, raw mode, cleanup).
   *
   * Requires an AppAdapter to be configured (e.g., from @pokit/opentui).
   *
   * @example
  * await r.app(MyBoardApp, {
  *   tasks,
  *   onSave: async (id, data) => { ... },
  * });
  */
  app<TProps>(
    component: AnyComponent<TProps>,
    props: TProps
  ): Promise<void>;

  /**
   * Run a task. Returns a deferred task that can be awaited directly
   * or passed to r.tabs() for tabbed execution.
   *
   * Task envs are resolved before execution.
   *
   * @example
   * // Execute immediately
   * await r.run(buildTask, { mode: 'dev' });
   *
   * // Pass to tabs for tabbed execution
   * await r.tabs([r.run(startViteDev), r.run(startStripeListener)]);
   */
  run<TReturn = void>(task: AnyTaskConfig, params?: Record<string, unknown>): DeferredTask<TReturn>;

  /**
   * Create a visual group for organizing related activities.
   * Groups provide visual structure (intro/outro) and contain activities.
   *
   * @example
   * await r.group('Database Setup', { layout: 'sequence' }, async (grp) => {
   *   await grp.activity('Run migrations', async () => {
   *     await r.run(migrateTask);
   *   });
   *   await grp.activity('Seed data', async () => {
   *     await r.run(seedTask);
   *   });
   * });
   */
  group<T>(
    label: string,
    options: GroupOptions,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T>;
}

/** Abstracted process type compatible with both Bun and Node.js */
type RuntimeProcess = SpawnResult;
type RunnerProcessSet = Set<RuntimeProcess>;

/**
 * Registry for tracking process sets across runner instances.
 * Uses WeakRef to allow garbage collection of abandoned runners.
 * Provides centralized signal handling for all registered runners.
 */
class ProcessRegistry {
  private static instance: ProcessRegistry;
  private runners = new Set<WeakRef<RunnerProcessSet>>();
  private signalHandlersRegistered = false;

  private constructor() {}

  static getInstance(): ProcessRegistry {
    if (!ProcessRegistry.instance) {
      ProcessRegistry.instance = new ProcessRegistry();
    }
    return ProcessRegistry.instance;
  }

  /**
   * Register a runner's process set with the registry.
   * Returns an unregister function to be called on runner cleanup.
   */
  register(processes: RunnerProcessSet): () => void {
    const ref = new WeakRef(processes);
    this.runners.add(ref);
    this.registerSignalHandlers();

    return () => {
      this.runners.delete(ref);
    };
  }

  /**
   * Kill all processes across all registered runners.
   * Used for signal handling cleanup.
   */
  killAll(): void {
    for (const ref of this.runners) {
      const processes = ref.deref();
      if (processes) {
        for (const proc of processes) {
          if (!proc.killed) {
            try {
              proc.kill();
            } catch {
              // Process may already be dead
            }
          }
        }
        processes.clear();
      }
    }
    // Clean up dead refs
    this.cleanupDeadRefs();
  }

  private cleanupDeadRefs(): void {
    for (const ref of this.runners) {
      if (!ref.deref()) {
        this.runners.delete(ref);
      }
    }
  }

  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) return;
    this.signalHandlersRegistered = true;

    const cleanup = () => {
      this.killAll();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

// =============================================================================
// Retry Helpers
// =============================================================================

/**
 * Calculate delay for a retry attempt based on the backoff strategy.
 */
function calculateRetryDelay(config: RetryConfig, attempt: number): number {
  const base = config.delay ?? 1000;
  let delay: number;

  switch (config.backoff ?? 'fixed') {
    case 'fixed':
      delay = base;
      break;
    case 'linear':
      delay = base * (attempt + 1);
      break;
    case 'exponential':
      delay = base * Math.pow(2, attempt);
      break;
  }

  return config.maxDelay !== undefined ? Math.min(delay, config.maxDelay) : delay;
}

/**
 * Sleep for a specified duration, respecting abort signal.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new AbortError());
      },
      { once: true }
    );
  });
}

/**
 * Execute a function with retry logic.
 * Reports retry attempts via the optional onRetry callback.
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retry: RetryConfig | undefined,
  signal: AbortSignal | undefined,
  onRetry?: (attempt: number, maxAttempts: number, error: unknown) => void
): Promise<T> {
  if (!retry) {
    return fn();
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retry.maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new AbortError();
    }

    try {
      return await fn();
    } catch (error) {
      // Don't retry on abort
      if (error instanceof AbortError) {
        throw error;
      }

      lastError = error;

      // If we have more attempts, wait and retry
      if (attempt < retry.maxAttempts) {
        onRetry?.(attempt + 1, retry.maxAttempts, error);
        const delay = calculateRetryDelay(retry, attempt);
        await sleep(delay, signal);
      }
    }
  }

  throw lastError;
}

export type RunnerOptions<TContext extends Record<string, unknown>> = {
  cwd: string;
  context: TContext;
  extraArgs: string[];
  timeout?: number;
  quiet?: boolean;
  /** AbortSignal for cancelling execution */
  signal?: AbortSignal;
  /** EventBus for event-driven output */
  eventBus: EventBus;
  /** Optional tabs adapter for tabbed terminal UI */
  tabs?: TabsAdapter;
  /** Optional app adapter for fullscreen TUI applications */
  app?: AppAdapter;
  /** Prompter for interactive input */
  prompter: Prompter;
};

/**
 * Error class that includes captured output from failed commands
 */
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly output: string
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

export function createRunner<TContext extends Record<string, unknown>>(
  options: RunnerOptions<TContext>
): Runner<TContext> {
  const {
    cwd,
    context,
    extraArgs: forwardedArgs,
    timeout: defaultTimeout,
    quiet = false,
    signal,
    tabs: tabsAdapter,
    app: appAdapter,
    eventBus,
    prompter,
  } = options;

  const reporter: Reporter = new ScopedReporter(eventBus, 'root', 'root');
  const envCache = new Map<string, string>();
  // Track processes spawned by this runner for cancellation
  const runnerProcesses: RunnerProcessSet = new Set<RuntimeProcess>();

  // Register this runner's process set with the global registry
  const registry = ProcessRegistry.getInstance();
  const unregisterFromRegistry = registry.register(runnerProcesses);

  const getAllCachedEnv = (): Record<string, string> => {
    return Object.fromEntries(envCache.entries());
  };

  /**
   * Kill all processes spawned by this runner
   */
  const killRunnerProcesses = (): void => {
    for (const proc of runnerProcesses) {
      if (!proc.killed) {
        try {
          proc.kill();
        } catch {
          // Process may already be dead
        }
      }
    }
    runnerProcesses.clear();
  };

  // If signal is provided, kill processes when aborted
  if (signal) {
    signal.addEventListener('abort', () => {
      killRunnerProcesses();
    });
  }

  /**
   * Merge process.env with additional env vars, filtering out undefined values.
   * This is needed because process.env has type Record<string, string | undefined>.
   *
   * Also handles unsetting variables: if additionalEnv has a key with value undefined,
   * it will be removed from the result.
   */
  const mergeEnv = (additionalEnv: Record<string, string | undefined>): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }

    for (const [key, value] of Object.entries(additionalEnv)) {
      if (value === undefined) {
        delete result[key];
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  /**
   * Read text from a web ReadableStream
   */
  const streamToText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> => {
    if (!stream) return '';
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const decoder = new TextDecoder();
    return chunks.map((chunk) => decoder.decode(chunk)).join('');
  };

  /**
   * Run an operation with optional timeout support.
   * Timeout cancellation is implemented via AbortSignal and normalized to TimeoutError.
   */
  const withTimeout = async <T>(
    cmdLabel: string,
    timeoutMs: number | undefined,
    parentSignal: AbortSignal | undefined,
    fn: (runSignal: AbortSignal | undefined) => Promise<T>
  ): Promise<T> => {
    if (timeoutMs === undefined) {
      return fn(parentSignal);
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TimeoutError(cmdLabel, timeoutMs);
    }

    const controller = new AbortController();
    const runSignal = parentSignal
      ? AbortSignal.any([parentSignal, controller.signal])
      : controller.signal;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fn(runSignal);
    } catch (error) {
      if (timedOut && error instanceof AbortError) {
        throw new TimeoutError(cmdLabel, timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  /* Shared command execution helper */
  const executeCmd = async (
    cmd: ExecInput,
    options: {
      cwd: string;
      env: Record<string, string>;
      quiet: boolean;
      signal?: AbortSignal;
      interactive?: boolean;
    }
  ): Promise<void> => {
    const { cwd: runCwd, env, quiet: runQuiet, signal: runSignal, interactive } = options;
    const cmdLabel = execInputToString(cmd);

    // Check if already aborted
    if (runSignal?.aborted) {
      throw new AbortError();
    }

    // Get runtime for process spawning
    const runtime = await getRuntime();

    try {
      if (isShellPromise(cmd)) {
        // Bun shell form: apply env and cwd, then await
        // This only works in Bun runtime - in Node.js, ShellPromise won't exist
        await cmd.env(env).cwd(runCwd);
      } else if (Array.isArray(cmd)) {
        // Array form: bypass shell entirely using runtime.spawn
        // Always pipe output so we can capture it for error messages
        const proc = runtime.spawn(cmd, {
          cwd: runCwd,
          stdio: 'pipe',
          env,
        });

        runnerProcesses.add(proc);

        // Capture output while optionally streaming to terminal
        const stdoutChunks: Uint8Array[] = [];
        const stderrChunks: Uint8Array[] = [];

        // Read streams in parallel with process execution
        const readStream = async (
          stream: ReadableStream<Uint8Array> | null,
          chunks: Uint8Array[],
          output: NodeJS.WriteStream | null
        ): Promise<void> => {
          if (!stream) return;
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                chunks.push(value);
                if (output) {
                  output.write(value);
                }
              }
            }
          } catch {
            // Stream may be cancelled when process is killed
          } finally {
            reader.releaseLock();
          }
        };

        const stdoutPromise = readStream(
          proc.stdout,
          stdoutChunks,
          runQuiet ? null : process.stdout
        );
        const stderrPromise = readStream(
          proc.stderr,
          stderrChunks,
          runQuiet ? null : process.stderr
        );

        // Create abort promise if signal provided
        const abortPromise = runSignal
          ? new Promise<'aborted'>((resolve) => {
              if (runSignal.aborted) resolve('aborted');
              else runSignal.addEventListener('abort', () => resolve('aborted'), { once: true });
            })
          : null;

        // Wait for exit code, racing against abort signal
        const exitResult = abortPromise
          ? await Promise.race([
              proc.exited.then((code) => ({ type: 'exit' as const, code })),
              abortPromise,
            ])
          : { type: 'exit' as const, code: await proc.exited };

        runnerProcesses.delete(proc);

        if (exitResult === 'aborted' || runSignal?.aborted) {
          // Kill the process if still running
          if (!proc.killed) {
            try {
              proc.kill();
            } catch {
              // Process may already be dead
            }
          }
          throw new AbortError();
        }

        const exitCode = exitResult.code;

        // Give streams a short time to flush, but don't block indefinitely
        await Promise.race([
          Promise.all([stdoutPromise, stderrPromise]),
          new Promise((resolve) => setTimeout(resolve, 100)),
        ]);

        if (exitCode !== 0) {
          const decoder = new TextDecoder();
          const stdout = stdoutChunks
            .map((c) => decoder.decode(c))
            .join('')
            .trim();
          const stderr = stderrChunks
            .map((c) => decoder.decode(c))
            .join('')
            .trim();
          const output = [stdout, stderr].filter(Boolean).join('\n');
          throw new CommandError(`Command failed: ${cmdLabel}`, output);
        }
      } else {
        // String form: pass to sh -c
        const finalCmd = cmd.trim();
        if (interactive) {
          // Interactive mode: use spawn with inherited stdio for browser auth, OTP prompts, etc.
          // Cannot capture output in interactive mode
          const proc = runtime.spawn(['sh', '-c', finalCmd], {
            cwd: runCwd,
            stdio: 'inherit',
            env,
          });

          runnerProcesses.add(proc);
          const exitCode = await proc.exited;
          runnerProcesses.delete(proc);

          if (runSignal?.aborted) {
            throw new AbortError();
          }

          if (exitCode !== 0) {
            throw new CommandError(`Command failed: ${finalCmd}`, '');
          }
        } else {
          // Always pipe and capture output so we can show it on failure
          const proc = runtime.spawn(['sh', '-c', finalCmd], {
            cwd: runCwd,
            stdio: 'pipe',
            env,
          });

          runnerProcesses.add(proc);

          // Capture output while optionally streaming to terminal
          const stdoutChunks: Uint8Array[] = [];
          const stderrChunks: Uint8Array[] = [];

          // Read streams in parallel with process execution
          const readStream = async (
            stream: ReadableStream<Uint8Array> | null,
            chunks: Uint8Array[],
            output: NodeJS.WriteStream | null
          ): Promise<void> => {
            if (!stream) return;
            const reader = stream.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                  chunks.push(value);
                  if (output) {
                    output.write(value);
                  }
                }
              }
            } catch {
              // Stream may be cancelled when process is killed
            } finally {
              reader.releaseLock();
            }
          };

          const stdoutPromise = readStream(
            proc.stdout,
            stdoutChunks,
            runQuiet ? null : process.stdout
          );
          const stderrPromise = readStream(
            proc.stderr,
            stderrChunks,
            runQuiet ? null : process.stderr
          );

          // Create abort promise if signal provided
          const abortPromise = runSignal
            ? new Promise<'aborted'>((resolve) => {
                if (runSignal.aborted) resolve('aborted');
                else runSignal.addEventListener('abort', () => resolve('aborted'), { once: true });
              })
            : null;

          // Wait for exit code, racing against abort signal
          const exitResult = abortPromise
            ? await Promise.race([
                proc.exited.then((code) => ({ type: 'exit' as const, code })),
                abortPromise,
              ])
            : { type: 'exit' as const, code: await proc.exited };

          runnerProcesses.delete(proc);

          if (exitResult === 'aborted' || runSignal?.aborted) {
            // Kill the process if still running
            if (!proc.killed) {
              try {
                proc.kill();
              } catch {
                // Process may already be dead
              }
            }
            throw new AbortError();
          }

          const exitCode = exitResult.code;

          // Give streams a short time to flush, but don't block indefinitely
          await Promise.race([
            Promise.all([stdoutPromise, stderrPromise]),
            new Promise((resolve) => setTimeout(resolve, 100)),
          ]);

          if (exitCode !== 0) {
            const decoder = new TextDecoder();
            const stdout = stdoutChunks
              .map((c) => decoder.decode(c))
              .join('')
              .trim();
            const stderr = stderrChunks
              .map((c) => decoder.decode(c))
              .join('')
              .trim();
            const output = [stdout, stderr].filter(Boolean).join('\n');
            throw new CommandError(`Command failed: ${finalCmd}`, output);
          }
        }
      }
    } catch (error) {
      // Re-throw AbortError and CommandError as-is
      if (error instanceof AbortError || error instanceof CommandError) {
        throw error;
      }
      if (error && typeof error === 'object' && 'stdout' in error) {
        // Bun shell error includes stdout/stderr
        const shellError = error as {
          stdout: Buffer;
          stderr: Buffer;
          message?: string;
        };
        const output = [shellError.stdout?.toString().trim(), shellError.stderr?.toString().trim()]
          .filter(Boolean)
          .join('\n');
        throw new CommandError(`Command failed: ${cmdLabel}`, output);
      }
      throw new CommandError(
        `Command failed: ${cmdLabel}`,
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const exec = (cmd: ExecInput, opts?: ExecOptions): Command => {
    return {
      _type: 'command',
      cmd,
      opts,
      then(onFulfilled, onRejected) {
        const execute = async (): Promise<void> => {
          const allEnv = getAllCachedEnv();
          const mergedEnv = { ...allEnv, ...opts?.env };
          const timeout = opts?.timeout ?? defaultTimeout;
          const cmdLabel = execInputToString(cmd);

          await withTimeout(cmdLabel, timeout, signal, async (runSignal) =>
            executeWithRetry(
              () =>
                executeCmd(cmd, {
                  cwd: opts?.cwd || cwd,
                  env: mergeEnv(mergedEnv),
                  quiet,
                  signal: runSignal,
                  interactive: opts?.interactive,
                }),
              opts?.retry,
              runSignal,
              (attempt, max) => {
                reporter.warn(`Retrying command (${attempt}/${max})...`);
              }
            )
          );
        };

        return execute().then(onFulfilled, onRejected);
      },
    };
  };

  /**
   * Execute a single parallel item with retry support.
   */
  const executeParallelItem = async (
    item: RunnerItem,
    index: number,
    envVars: Record<string, string>,
    itemSignal?: AbortSignal
  ): Promise<void> => {
    if (isCommand(item)) {
      const retryConfig = item.opts?.retry;
      const timeout = item.opts?.timeout ?? defaultTimeout;
      const cmdLabel = execInputToString(item.cmd);
      await withTimeout(cmdLabel, timeout, itemSignal, async (runSignal) =>
        executeWithRetry(
          () =>
            executeCmd(item.cmd, {
              cwd: item.opts?.cwd || cwd,
              env: envVars,
              quiet: false,
              signal: runSignal,
            }),
          retryConfig,
          runSignal,
          (attempt, max) => {
            reporter.warn(`Retrying command (${attempt}/${max})...`);
          }
        )
      );
    } else if (isDeferredTask(item)) {
      await executeTask(item.task, item.params, itemSignal);
    } else {
      throw new CommandError(
        `r.parallel() item at index ${index} is invalid`,
        'r.parallel() only accepts commands (r.exec) or tasks (r.run).'
      );
    }
  };

  const parallel = async (items: RunnerItem[], options?: ParallelOptions): Promise<void> => {
    if (items.length === 0) return;
    if (items.length === 1) {
      await executeParallelItem(items[0]!, 0, mergeEnv(getAllCachedEnv()), signal);
      return;
    }

    const mode = options?.mode ?? 'race';
    const allEnv = getAllCachedEnv();
    const envVars = mergeEnv(allEnv);

    switch (mode) {
      case 'race': {
        // Race mode: first to settle wins, cancel rest
        const promises = items.map((item, index) =>
          executeParallelItem(item, index, envVars, signal)
        );

        try {
          await Promise.race(promises);
        } finally {
          killRunnerProcesses();
        }
        break;
      }

      case 'fail-fast': {
        // Fail-fast mode: first failure cancels rest, otherwise wait for all
        const controller = new AbortController();
        const itemSignal = signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal;

        let firstError: unknown = null;

        const promises = items.map(async (item, index) => {
          if (controller.signal.aborted) return;

          try {
            await executeParallelItem(item, index, envVars, itemSignal);
          } catch (error) {
            if (error instanceof AbortError || controller.signal.aborted) return;
            if (!firstError) {
              firstError = error;
              controller.abort();
            }
          }
        });

        await Promise.allSettled(promises);
        killRunnerProcesses();

        if (firstError) {
          throw firstError;
        }
        break;
      }

      case 'all-settled': {
        // All-settled mode: run all to completion, collect errors
        const errors: { index: number; error: unknown }[] = [];

        const promises = items.map(async (item, index) => {
          try {
            await executeParallelItem(item, index, envVars, signal);
          } catch (error) {
            if (!(error instanceof AbortError)) {
              errors.push({ index, error });
            }
          }
        });

        await Promise.allSettled(promises);
        killRunnerProcesses();

        if (errors.length > 0) {
          const errorMessages = errors.map(({ index, error }) => {
            const label = getItemLabel(items[index]!);
            const msg = error instanceof Error ? error.message : String(error);
            return `[${index}] ${label}: ${msg}`;
          });
          throw new AggregateError(
            errors.map((e) => e.error),
            `${errors.length} of ${items.length} parallel items failed:\n${errorMessages.join('\n')}`
          );
        }
        break;
      }
    }
  };

  /**
   * Get a display label for a runner item.
   */
  const getItemLabel = (item: RunnerItem): string => {
    if (isCommand(item)) {
      return execInputToString(item.cmd);
    } else if (isDeferredTask(item)) {
      return item.task.label;
    }
    return 'unknown';
  };

  const executeTask = async <TReturn>(
    task: AnyTaskConfig,
    params?: Record<string, unknown>,
    taskSignal?: AbortSignal
  ): Promise<TReturn> => {
    const runSignal = taskSignal ?? signal;

    // Check if already aborted before starting
    if (runSignal?.aborted) {
      throw new AbortError();
    }

    // Resolve env if task declares env(s)
    const taskEnvs: Record<string, unknown> = {};
    if (task.env) {
      // Normalize to array (last occurrence wins when merging)
      const envs: AnyEnv[] = Array.isArray(task.env) ? task.env : [task.env];
      const mergedRawEnv: Record<string, string> = {};

      for (const env of envs) {
        const keys = getEnvKeys(env);
        const resolver = env.resolver;
        const rawEnv = await resolver.resolve(keys, context);

        for (const [key, value] of Object.entries(rawEnv)) {
          if (value !== undefined) {
            mergedRawEnv[key] = value;
            envCache.set(key, value);
          }
        }
      }

      // Copy resolved vars to taskEnvs
      Object.assign(taskEnvs, mergedRawEnv);
    }

    // Validate params
    const taskParams = task.params ? task.params.parse(params ?? {}) : {};

    // Build writeEnvs function
    let writeEnvs: ((values: Partial<Record<string, string>>) => Promise<void>) | undefined;
    if (task.envWriter) {
      const envWriter = task.envWriter as AnyEnv;
      const declaredVars = new Set(envWriter.vars);

      writeEnvs = async (values: Partial<Record<string, string>>): Promise<void> => {
        const definedValues: Record<string, string> = {};
        for (const [key, value] of Object.entries(values)) {
          if (value === undefined) continue;
          if (!declaredVars.has(key)) {
            throw new Error(
              `Cannot write undeclared variable "${key}". Declared vars: ${[...declaredVars].join(', ')}`
            );
          }
          definedValues[key] = value;
        }

        if (!envWriter.resolver.write) {
          throw new Error('Resolver for envWriter does not implement write method.');
        }

        await envWriter.resolver.write(definedValues, context);
      };
    }

    const taskContext: TaskContext<unknown, unknown, typeof writeEnvs, typeof context> = {
      context,
      cwd,
      envs: taskEnvs,
      params: taskParams,
      extraArgs: forwardedArgs,
      reporter,
      writeEnvs,
    };

    if ('exec' in task) {
      const execTask = task as ExecTaskConfig;
      const cmd =
        typeof execTask.exec === 'function' ? execTask.exec(taskContext as any) : execTask.exec;

      const allEnv = getAllCachedEnv();
      const timeout = defaultTimeout;

      try {
        await withTimeout(execInputToString(cmd), timeout, runSignal, async (taskExecSignal) =>
          executeWithRetry(
            () =>
              executeCmd(cmd, {
                cwd,
                env: mergeEnv(allEnv),
                quiet,
                signal: taskExecSignal,
              }),
            task.retry,
            taskExecSignal,
            (attempt, max) => {
              reporter.warn(`Retrying task "${task.label}" (${attempt}/${max})...`);
            }
          )
        );
      } catch (error) {
        if (error instanceof CommandError || error instanceof AbortError) {
          throw error;
        }
        throw new CommandError(
          `Task "${task.label}" failed`,
          error instanceof Error ? error.message : String(error)
        );
      }

      return undefined as TReturn;
    } else {
      const runTask = task as RunTaskConfig;
      return executeWithRetry(
        () => runTask.run(runner, taskContext as any) as Promise<TReturn>,
        task.retry,
        runSignal,
        (attempt, max) => {
          reporter.warn(`Retrying task "${task.label}" (${attempt}/${max})...`);
        }
      );
    }
  };

  const run = <TReturn>(
    task: AnyTaskConfig,
    params?: Record<string, unknown>
  ): DeferredTask<TReturn> => {
    return {
      _type: 'deferred-task',
      task,
      params,
      then(onFulfilled, onRejected) {
        return executeTask<TReturn>(task, params).then(onFulfilled, onRejected);
      },
    };
  };

  const tabs = async (items: RunnerItem[], options?: TabsRunnerOptions): Promise<void> => {
    if (!tabsAdapter) {
      throw new Error(
        'Tabs adapter not available. Please provide a TabsAdapter in RunnerOptions to use r.tabs().\n' +
          'Install @pokit/opentui and pass the adapter:\n' +
          '  import { createTabsAdapter } from "@pokit/opentui";\n' +
          '  // In your router config:\n' +
          '  tabs: createTabsAdapter()'
      );
    }

    if (items.length === 0) return;

    // Validate items first
    for (const item of items) {
      if (isDeferredTask(item)) {
        const { task } = item;
        if (!('exec' in task)) {
          throw new Error(
            `r.tabs() only supports exec tasks. Task "${task.label}" is not an exec task.`
          );
        }
      } else if (!isCommand(item)) {
        throw new Error('r.tabs() only accepts commands (r.exec) or tasks (r.run).');
      }
    }

    // Collect all envs that need to be resolved
    const envsToResolve: AnyEnv[] = [];
    for (const item of items) {
      if (isDeferredTask(item) && item.task.env) {
        const taskEnvs: AnyEnv[] = Array.isArray(item.task.env) ? item.task.env : [item.task.env];
        for (const env of taskEnvs) {
          envsToResolve.push(env);
        }
      }
    }

    // Resolve envs with UI feedback if there are any
    if (envsToResolve.length > 0) {
      await reporter.group('Loading Secrets', { layout: 'sequence' }, async (groupReporter) => {
        for (const env of envsToResolve) {
          const keys = getEnvKeys(env);
          // Skip if all keys are already cached
          const uncachedKeys = keys.filter((k) => !envCache.has(k));
          if (uncachedKeys.length === 0) continue;

          // Build descriptive label showing which secrets are being loaded
          const label =
            uncachedKeys.length <= 3
              ? uncachedKeys.join(', ')
              : `${uncachedKeys.slice(0, 2).join(', ')} +${uncachedKeys.length - 2} more`;

          await groupReporter.activity(label, async () => {
            const resolver = env.resolver;
            const rawEnv = await resolver.resolve(keys, context);
            for (const [key, value] of Object.entries(rawEnv)) {
              if (value !== undefined) {
                envCache.set(key, value);
              }
            }
          });
        }
      });
    }

    const allEnv = getAllCachedEnv();
    const envVars = { ...process.env, ...allEnv };

    // Get runtime for shell escaping
    const runtime = await getRuntime();

    // Helper to convert ExecInput to string for tabs (tabs always use shell)
    const execInputToTabsString = (cmd: ExecInput): string => {
      if (typeof cmd === 'string') {
        return cmd;
      }
      if (Array.isArray(cmd)) {
        // Convert array to shell-escaped string using runtime's escape
        return cmd.map((arg) => runtime.escapeShell(arg)).join(' ');
      }
      // ShellPromise cannot be converted to string for tabs
      throw new Error(
        'r.tabs() does not support Bun shell ($`...`) commands. ' +
          'Use string or array form instead.'
      );
    };

    // Convert items to tab specs
    const tabSpecs: TabSpec[] = items.map((item) => {
      if (isCommand(item)) {
        const execStr = execInputToTabsString(item.cmd);
        // Command: use first word (binary name) as label
        const label = execStr.split(/\s+/)[0] ?? execStr;
        return { label, exec: execStr };
      }

      // DeferredTask: extract exec command from task
      const { task, params } = item as DeferredTask<unknown>;
      const execTask = task as ExecTaskConfig<any, any, any>;
      let execCmd: ExecInput;

      if (typeof execTask.exec === 'function') {
        // Build task context for exec function
        const taskEnvs: Record<string, unknown> = {};
        if (execTask.env) {
          const envs: AnyEnv[] = Array.isArray(execTask.env) ? execTask.env : [execTask.env];
          for (const env of envs) {
            for (const key of env.vars) {
              const value = envCache.get(key);
              if (value !== undefined) {
                taskEnvs[key] = value;
              }
            }
          }
        }
        const taskParams = execTask.params ? execTask.params.parse(params ?? {}) : {};
        const taskContext = {
          context,
          cwd,
          envs: taskEnvs,
          params: taskParams,
          extraArgs: forwardedArgs,
          reporter,
          writeEnvs: undefined,
        };
        execCmd = execTask.exec(taskContext as any);
      } else {
        execCmd = execTask.exec;
      }

      const execStr = execInputToTabsString(execCmd);

      // Use shortLabel if provided, otherwise derive from exec command
      const label =
        execTask.shortLabel ??
        (typeof execTask.exec === 'string'
          ? (execTask.exec.split(/\s+/)[0] ?? execTask.label)
          : execTask.label);
      return { label, exec: execStr };
    });

    // Derive name from tab labels if not provided
    const name = options?.name ?? tabSpecs.map((t) => t.label).join(' + ') ?? 'console';

    // Single item - just run it directly with inherited stdio
    if (tabSpecs.length === 1) {
      const item = tabSpecs[0]!;
      const proc = runtime.spawn(['sh', '-c', item.exec], {
        cwd,
        stdio: 'inherit',
        env: envVars,
      });

      runnerProcesses.add(proc);
      const exitCode = await proc.exited;
      runnerProcesses.delete(proc);

      if (exitCode !== 0 && exitCode !== null) {
        throw new CommandError(
          `Command failed with exit code ${exitCode}: ${item.exec}`,
          '' // tabs single-item mode doesn't capture output
        );
      }
      return;
    }

    // Multiple items - use tabbed UI
    // Suspend reporter before OpenTUI takes over the terminal
    reporter.suspend();
    try {
      await tabsAdapter.run(tabSpecs, { name, cwd, env: envVars });
    } finally {
      reporter.resume();
    }
  };

  const app = async <TProps>(
    component: AnyComponent<TProps>,
    props: TProps
  ): Promise<void> => {
    if (!appAdapter) {
      throw new Error(
        'App adapter not available. Please provide an AppAdapter in your config to use r.app().\n' +
          'Install @pokit/opentui and pass the adapter:\n' +
          '  import { createAppAdapter } from "@pokit/opentui";\n' +
          '  // In your pok.config.ts:\n' +
          '  app: createAppAdapter()'
      );
    }

    // Suspend reporter before app takes over the terminal
    reporter.suspend();
    try {
      await appAdapter.run(component, props);
    } finally {
      reporter.resume();
    }
  };

  const group = <T>(
    label: string,
    options: GroupOptions,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T> => {
    return reporter.group(label, options, fn);
  };

  const runner: Runner<TContext> = {
    cwd,
    reporter,
    prompter,
    exec,
    parallel,
    tabs,
    app,
    run,
    group,
  };
  return runner;
}
