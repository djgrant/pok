import { z } from 'zod';
import type { Env, InferEnvVars, InferEnvContext } from './env';
import type { TaskReporter } from '../events';

type RunnerLike = {
  exec(cmd: string, opts?: unknown): unknown;
};

type EmptyObject = Record<string, never>;

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
  exec:
    | string
    | ((
        ctx: TaskContext<
          TEnv extends undefined ? EmptyObject : InferEnvVarsFromConfig<TEnv>,
          TParams extends z.ZodType ? z.infer<TParams> : EmptyObject,
          TEnvWriter extends AnyEnv ? WriteEnvsFn<TEnvWriter['vars'][number]> : undefined
        >
      ) => string);
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
  exec:
    | string
    | ((
        ctx: TaskContext<
          TEnv extends undefined ? EmptyObject : InferEnvVarsFromConfig<TEnv>,
          TParams extends z.ZodType ? z.infer<TParams> : EmptyObject,
          TEnvWriter extends AnyEnv ? WriteEnvsFn<TEnvWriter['vars'][number]> : undefined
        >
      ) => string);
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
  exec?: string | ((ctx: TaskContext<any, any, any>) => string);
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
