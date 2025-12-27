import { z } from 'zod';
import type { Env, InferEnvVars, InferEnvContext } from './env';
import type { TaskReporter } from '../events';

/**
 * Bun ShellPromise type - extracted from bun types for use in ExecInput.
 * This represents the result of Bun's `$\`command\`` template literal.
 */
export type ShellPromise = Promise<unknown> & {
  cwd(newCwd: string): ShellPromise;
  env(newEnv: Record<string, string | undefined> | undefined): ShellPromise;
  quiet(isQuiet?: boolean): ShellPromise;
  nothrow(): ShellPromise;
  throws(shouldThrow: boolean): ShellPromise;
  text(encoding?: BufferEncoding): Promise<string>;
  json(): Promise<unknown>;
  lines(): AsyncIterable<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
};

type RunnerLike = {
  exec(cmd: ExecInput, opts?: unknown): unknown;
};

/**
 * Input types for exec commands:
 * - string: Passed to sh -c (existing behavior)
 * - string[]: Array of arguments, bypasses shell (safe for dynamic input)
 * - ShellPromise: Bun shell template, provides automatic escaping
 */
export type ExecInput = string | string[] | ShellPromise;

/**
 * Check if a value is a Bun ShellPromise
 */
export function isShellPromise(value: unknown): value is ShellPromise {
  return (
    value !== null &&
    typeof value === 'object' &&
    value instanceof Promise &&
    'cwd' in value &&
    'env' in value &&
    'quiet' in value
  );
}

/**
 * Convert an ExecInput to a display string for logging/labels
 */
export function execInputToString(input: ExecInput): string {
  if (typeof input === 'string') {
    return input;
  }
  if (Array.isArray(input)) {
    // Join array elements, quoting those with spaces
    return input.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ');
  }
  // ShellPromise - we can't easily extract the command, use placeholder
  return '[shell command]';
}

type EmptyObject = Record<string, never>;

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Backoff strategy constants with descriptions.
 */
export const BackoffStrategies = {
  /**
   * Same delay between each retry.
   * @example delay=1000 → waits 1s, 1s, 1s...
   */
  fixed: 'fixed',
  /**
   * Delay increases linearly: `delay * (attempt + 1)`.
   * @example delay=1000 → waits 1s, 2s, 3s...
   */
  linear: 'linear',
  /**
   * Delay doubles each attempt: `delay * 2^attempt`.
   * @example delay=1000 → waits 1s, 2s, 4s, 8s...
   */
  exponential: 'exponential',
} as const;

/**
 * Backoff strategy for retries.
 * - `'fixed'`: Same delay between each retry
 * - `'linear'`: Delay increases linearly (`delay * attempt`)
 * - `'exponential'`: Delay doubles each attempt (`delay * 2^attempt`)
 */
export type BackoffStrategy = (typeof BackoffStrategies)[keyof typeof BackoffStrategies];

/**
 * Configuration for retry behavior on task failure.
 */
export type RetryConfig = {
  /**
   * Maximum number of retry attempts (not including the initial attempt).
   * e.g., maxAttempts: 3 means up to 4 total executions.
   */
  maxAttempts: number;
  /**
   * Base delay between retries in milliseconds.
   * @default 1000
   */
  delay?: number;
  /**
   * Backoff strategy for calculating delay between retries.
   *
   * - `'fixed'`: Same delay between each retry
   * - `'linear'`: Delay increases linearly (`delay * attempt`)
   * - `'exponential'`: Delay doubles each attempt (`delay * 2^attempt`)
   *
   * @default 'fixed'
   */
  backoff?: BackoffStrategy;
  /**
   * Maximum delay in milliseconds (caps exponential/linear growth).
   */
  maxDelay?: number;
};

/**
 * Function to write environment variables to the configured writer.
 * Only available when the task declares `envWriter`.
 *
 * Accepts a partial record where keys must be a subset of the declared vars.
 */
export type WriteEnvsFn<TVars extends string> = (
  values: Partial<Record<TVars, string>>
) => Promise<void>;

export type TaskContext<
  TEnvs = Record<string, never>,
  TParams = Record<string, never>,
  TWriteEnvs extends WriteEnvsFn<string> | undefined = undefined,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> = {
  /** Resolved context values inherited from the parent command */
  context: TContext;
  /** Project root directory */
  cwd: string;
  envs: TEnvs;
  params: TParams;
  extraArgs: string[];
  /**
   * Reporter for event-driven output, scoped to the current task.
   * Use this to emit events for logging and progress updates.
   */
  reporter: TaskReporter;
  /**
   * Write environment variables to the task's configured envWriter.
   * Only available when the task declares `envWriter`.
   */
  writeEnvs: TWriteEnvs;
};

// Using `any` here to allow any Env to be passed through
type AnyEnv = Env<any, any>;

// Helper to merge env vars from array of envs (union of all keys)
type MergeEnvVars<T extends readonly AnyEnv[]> = T extends readonly [
  infer First extends AnyEnv,
  ...infer Rest extends readonly AnyEnv[],
]
  ? InferEnvVars<First> & MergeEnvVars<Rest>
  : EmptyObject;

// Helper to infer env vars from single env or array
type InferEnvVarsFromConfig<T> = T extends AnyEnv
  ? InferEnvVars<T>
  : T extends readonly AnyEnv[]
    ? MergeEnvVars<T>
    : EmptyObject;

export type ExecTaskConfig<
  TEnv extends AnyEnv | readonly AnyEnv[] | undefined = undefined,
  TParams extends z.ZodType | undefined = undefined,
  TEnvWriter extends AnyEnv | undefined = undefined,
> = {
  label: string;
  /**
   * Short label for tab display. Defaults to first word of exec command.
   */
  shortLabel?: string;
  env?: TEnv;
  params?: TParams;
  /**
   * Optional env for writing. When specified, ctx.writeEnvs becomes available.
   * The env must have a resolver that implements the `write` method.
   */
  envWriter?: TEnvWriter;
  /**
   * Retry configuration for this task.
   * When specified, failed executions will be retried according to this config.
   */
  retry?: RetryConfig;
  /**
   * Command to execute. Supports three forms:
   * - string: Passed to sh -c (for static commands)
   * - string[]: Array of arguments, bypasses shell (safe for dynamic input)
   * - $.ShellPromise: Bun shell template (provides automatic escaping)
   */
  exec:
    | ExecInput
    | ((
        ctx: TaskContext<
          TEnv extends undefined ? EmptyObject : InferEnvVarsFromConfig<TEnv>,
          TParams extends z.ZodType ? z.infer<TParams> : EmptyObject,
          TEnvWriter extends AnyEnv ? WriteEnvsFn<TEnvWriter['vars'][number]> : undefined
        >
      ) => ExecInput);
};

export type RunTaskConfig<
  TEnv extends AnyEnv | readonly AnyEnv[] | undefined = undefined,
  TParams extends z.ZodType | undefined = undefined,
  TEnvWriter extends AnyEnv | undefined = undefined,
  TReturn = void,
> = {
  label: string;
  /**
   * Short label for tab display. Defaults to label.
   */
  shortLabel?: string;
  env?: TEnv;
  params?: TParams;
  /**
   * Optional env for writing. When specified, ctx.writeEnvs becomes available.
   * The env must have a resolver that implements the `write` method.
   */
  envWriter?: TEnvWriter;
  /**
   * Retry configuration for this task.
   * When specified, failed executions will be retried according to this config.
   */
  retry?: RetryConfig;
  run: (
    runner: RunnerLike,
    ctx: TaskContext<
      TEnv extends undefined ? EmptyObject : InferEnvVarsFromConfig<TEnv>,
      TParams extends z.ZodType ? z.infer<TParams> : EmptyObject,
      TEnvWriter extends AnyEnv ? WriteEnvsFn<TEnvWriter['vars'][number]> : undefined
    >
  ) => Promise<TReturn> | TReturn;
};

export type AnyTaskConfig =
  | ExecTaskConfig<
      AnyEnv | readonly AnyEnv[] | undefined,
      z.ZodType | undefined,
      AnyEnv | undefined
    >
  | RunTaskConfig<
      AnyEnv | readonly AnyEnv[] | undefined,
      z.ZodType | undefined,
      AnyEnv | undefined,
      unknown
    >;

// Single overload for exec tasks
export function defineTask<
  TEnv extends AnyEnv | readonly AnyEnv[] | undefined = undefined,
  TParams extends z.ZodType | undefined = undefined,
  TEnvWriter extends AnyEnv | undefined = undefined,
>(config: {
  label: string;
  shortLabel?: string;
  env?: TEnv;
  params?: TParams;
  envWriter?: TEnvWriter;
  retry?: RetryConfig;
  exec:
    | ExecInput
    | ((
        ctx: TaskContext<
          TEnv extends undefined ? EmptyObject : InferEnvVarsFromConfig<TEnv>,
          TParams extends z.ZodType ? z.infer<TParams> : EmptyObject,
          TEnvWriter extends AnyEnv ? WriteEnvsFn<TEnvWriter['vars'][number]> : undefined
        >
      ) => ExecInput);
}): ExecTaskConfig<TEnv, TParams, TEnvWriter>;

// Single overload for run tasks
export function defineTask<
  TEnv extends AnyEnv | readonly AnyEnv[] | undefined = undefined,
  TParams extends z.ZodType | undefined = undefined,
  TEnvWriter extends AnyEnv | undefined = undefined,
  TReturn = void,
>(config: {
  label: string;
  shortLabel?: string;
  env?: TEnv;
  params?: TParams;
  envWriter?: TEnvWriter;
  retry?: RetryConfig;
  run: (
    runner: RunnerLike,
    ctx: TaskContext<
      TEnv extends undefined ? EmptyObject : InferEnvVarsFromConfig<TEnv>,
      TParams extends z.ZodType ? z.infer<TParams> : EmptyObject,
      TEnvWriter extends AnyEnv ? WriteEnvsFn<TEnvWriter['vars'][number]> : undefined
    >
  ) => Promise<TReturn> | TReturn;
}): RunTaskConfig<TEnv, TParams, TEnvWriter, TReturn>;

// Implementation
export function defineTask(config: {
  label: string;
  shortLabel?: string;
  env?: AnyEnv | readonly AnyEnv[];
  envWriter?: AnyEnv;
  params?: z.ZodType;
  retry?: RetryConfig;
  exec?: ExecInput | ((ctx: TaskContext<any, any, any>) => ExecInput);
  run?: (runner: RunnerLike, ctx: TaskContext<any, any, any>) => Promise<any> | any;
}): AnyTaskConfig {
  const hasExec = 'exec' in config && config.exec !== undefined;
  const hasRun = 'run' in config && config.run !== undefined;

  if (!hasExec && !hasRun) {
    throw new Error(`Task "${config.label}" must have either 'exec' or 'run' property`);
  }

  if (hasExec && hasRun) {
    throw new Error(`Task "${config.label}" cannot have both 'exec' and 'run' properties`);
  }

  return config as AnyTaskConfig;
}

// Type inference helpers

/**
 * Infer the required context from a task's env(s)
 * This extracts the resolver's requiredContext from the env(s)
 */
export type InferTaskContext<T> = T extends { env: infer E }
  ? E extends AnyEnv
    ? InferEnvContext<E>
    : E extends readonly AnyEnv[]
      ? InferEnvContext<E[number]>
      : EmptyObject
  : EmptyObject;

export type InferTaskEnvs<T> = T extends { env: infer E }
  ? E extends undefined
    ? EmptyObject
    : InferEnvVarsFromConfig<E>
  : EmptyObject;

export type InferTaskParams<T> = T extends { params: z.ZodType<infer P> } ? P : EmptyObject;

export type InferTaskReturn<T> = T extends { run: (...args: any[]) => infer R } ? Awaited<R> : void;
