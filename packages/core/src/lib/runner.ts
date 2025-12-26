import {
  type AnyTaskConfig,
  type ExecTaskConfig,
  type RunTaskConfig,
  type TaskContext,
  type ExecInput,
  isShellPromise,
  execInputToString,
} from './task';
import { type Env, getEnvKeys } from './env';
import { $ } from 'bun';
import type { TabsAdapter, TabSpec } from '../tabs';
import type { EventBus, Reporter, CommandReporter, GroupOptions } from '../events';
import { ScopedReporter } from '../events';
import type { Prompter } from '../prompter';

type AnyEnv = Env<any, any>;

export type ExecOptions = {
  timeout?: number;
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

/**
 * Options for the tabs runner.
 */
export type TabsRunnerOptions = {
  /** Name shown in console messages (e.g., "Opening {name} console...") */
  name?: string;
};

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
   * Exits when any item completes (race behavior), killing all others.
   *
   * Accepts commands (r.exec) or deferred tasks (r.run).
   *
   * @example
   * await r.parallel([r.exec('vite'), r.exec('stripe listen')]);
   * await r.parallel([r.run(task1), r.run(task2)]);
   */
  parallel(items: RunnerItem[]): Promise<void>;

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

type BunProcess = ReturnType<typeof Bun.spawn>;
type RunnerProcessSet = Set<BunProcess>;

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
    quiet = false,
    signal,
    tabs: tabsAdapter,
    eventBus,
    prompter,
  } = options;

  const reporter: Reporter = new ScopedReporter(eventBus, 'root', 'root');
  const envCache = new Map<string, string>();
  // Track processes spawned by this runner for cancellation
  const runnerProcesses: RunnerProcessSet = new Set<BunProcess>();

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

  /* Shared command execution helper */
  const executeCmd = async (
    cmd: ExecInput,
    options: {
      cwd: string;
      env: Record<string, string>;
      quiet: boolean;
      signal?: AbortSignal;
    }
  ): Promise<void> => {
    const { cwd: runCwd, env, quiet: runQuiet, signal: runSignal } = options;
    const cmdLabel = execInputToString(cmd);

    // Check if already aborted
    if (runSignal?.aborted) {
      throw new AbortError();
    }

    try {
      if (isShellPromise(cmd)) {
        // Bun shell form: apply env and cwd, then await
        await cmd.env(env).cwd(runCwd);
      } else if (Array.isArray(cmd)) {
        // Array form: bypass shell entirely using Bun.spawn
        const proc = Bun.spawn(cmd, {
          cwd: runCwd,
          stdio: runQuiet ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
          env,
        });

        runnerProcesses.add(proc);
        const exitCode = await proc.exited;
        runnerProcesses.delete(proc);

        if (runSignal?.aborted) {
          throw new AbortError();
        }

        if (exitCode !== 0 && exitCode !== null) {
          if (runQuiet) {
            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();
            const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
            throw new CommandError(`Command failed: ${cmdLabel}`, output);
          }
          throw new CommandError(`Command failed: ${cmdLabel}`, '');
        }
      } else {
        // String form: pass to sh -c
        const finalCmd = cmd.trim();
        if (runQuiet) {
          const proc = Bun.spawn(['sh', '-c', finalCmd], {
            cwd: runCwd,
            stdio: ['inherit', 'pipe', 'pipe'],
            env,
          });

          runnerProcesses.add(proc);
          const exitCode = await proc.exited;
          runnerProcesses.delete(proc);

          if (runSignal?.aborted) {
            throw new AbortError();
          }

          if (exitCode !== 0 && exitCode !== null) {
            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();
            const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
            throw new CommandError(`Command failed: ${finalCmd}`, output);
          }
        } else {
          await $`${{ raw: finalCmd }}`.env(env).cwd(runCwd);
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
        const output = [
          shellError.stdout?.toString().trim(),
          shellError.stderr?.toString().trim(),
        ]
          .filter(Boolean)
          .join('\n');
        throw new CommandError(`Command failed: ${cmdLabel}`, output);
      }
      throw new Error(
        `Command failed: ${cmdLabel}\n${error instanceof Error ? error.message : String(error)}`
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
          const mergedEnv = { ...process.env, ...allEnv };

          await executeCmd(cmd, {
            cwd,
            env: mergedEnv,
            quiet,
            signal,
          });
        };

        return execute().then(onFulfilled, onRejected);
      },
    };
  };

  const parallel = async (items: RunnerItem[]): Promise<void> => {
    if (items.length === 0) return;
    if (items.length === 1) {
      await items[0];
      return;
    }

    const allEnv = getAllCachedEnv();
    const envVars = { ...process.env, ...allEnv };

    const promises: Promise<void>[] = items.map((item) => {
      if (isCommand(item)) {
        return executeCmd(item.cmd, {
          cwd,
          env: envVars,
          quiet: false, // Parallel output is usually interleaved/handled by reporter, assuming non-quiet for now or standard inheritance
          // Note: Original code used ['inherit', 'inherit', 'inherit'] for all parallel execution branches
        });
      } else if (isDeferredTask(item)) {
        return item.then(() => {});
      } else {
        throw new Error('r.parallel() only accepts commands (r.exec) or tasks (r.run).');
      }
    });

    try {
      await Promise.race(promises);
    } finally {
      killRunnerProcesses();
    }
  };

  const executeTask = async <TReturn>(
    task: AnyTaskConfig,
    params?: Record<string, unknown>
  ): Promise<TReturn> => {
    // Check if already aborted before starting
    if (signal?.aborted) {
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
          mergedRawEnv[key] = value;
          envCache.set(key, value);
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
      const mergedEnv = { ...process.env, ...allEnv };

      try {
        await executeCmd(cmd, {
          cwd,
          env: mergedEnv,
          quiet,
          signal,
        });
      } catch (error) {
        if (error instanceof CommandError || error instanceof AbortError) {
          // Task specific error modification if needed, or just rethrow
          // The original code wrapped "Task '...' failed", unless it was Abort/CommandError?
          // Actually, original code re-threw Abort/CommandError AS-IS.
          // And wrapped generic errors.
          throw error;
        }
        throw new Error(
          `Task "${task.label}" failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      return undefined as TReturn;
    } else {
      const runTask = task as RunTaskConfig;
      return runTask.run(runner, taskContext as any) as TReturn;
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
        'Install @openpok/tabs-ink and pass the adapter:\n' +
        '  import { createTabsAdapter } from "@openpok/tabs-ink";\n' +
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
              envCache.set(key, value);
            }
          });
        }
      });
    }

    const allEnv = getAllCachedEnv();
    const envVars = { ...process.env, ...allEnv };

    // Helper to convert ExecInput to string for tabs (tabs always use shell)
    const execInputToTabsString = (cmd: ExecInput): string => {
      if (typeof cmd === 'string') {
        return cmd;
      }
      if (Array.isArray(cmd)) {
        // Convert array to shell-escaped string using Bun's escape
        return cmd.map((arg) => $.escape(arg)).join(' ');
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
      const proc = Bun.spawn(['sh', '-c', item.exec], {
        cwd,
        stdio: ['inherit', 'inherit', 'inherit'],
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
    run,
    group,
  };
  return runner;
}
