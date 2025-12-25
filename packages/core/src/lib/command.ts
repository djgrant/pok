/**
 * Command definition types and helpers
 *
 * Commands are defined declaratively and discovered via file-based routing.
 * Each command file exports a `command` object created with `defineCommand`.
 *
 * The runner is generic over the command's context, enabling type-safe task
 * execution where the type system enforces that tasks can only be run if
 * the command's context satisfies the task's requirements.
 */

import { z } from 'zod';
import type { CheckConfig } from './check';
import type { Runner } from './runner';

// =============================================================================
// Context Field Definition Types
// =============================================================================

/**
 * Source of a context field value
 */
export type ContextSource = 'flag';

/**
 * Context field definition
 *
 * Each field in a command's context specifies where its value comes from
 * and a Zod schema for validation/typing.
 */
export type ContextFieldDef = {
  /** Where the value comes from */
  from: ContextSource;
  /** Zod schema for validation and type inference */
  schema: z.ZodType;
  /** Human-readable description for help text */
  description?: string;
  /**
   * Explicit choices for select prompts (escape hatch)
   *
   * Use this when automatic enum extraction from the schema fails,
   * such as with custom refinements or complex schema compositions.
   *
   * @example
   * ```ts
   * mode: {
   *   from: 'flag',
   *   schema: z.string().refine(v => ['a', 'b', 'c'].includes(v)),
   *   choices: ['a', 'b', 'c'],  // Explicit fallback
   * }
   * ```
   */
  choices?: string[];
};

/**
 * Context definition - a record of field definitions
 */
export type ContextDef = Record<string, ContextFieldDef>;

/**
 * Infer the resolved context type from a context definition
 *
 * Extracts the Zod-inferred type for each field.
 */
export type InferContext<C extends ContextDef> = {
  [K in keyof C]: z.infer<C[K]['schema']>;
};

/**
 * Context passed to hooks
 */
export type HookContext<C extends ContextDef = ContextDef> = InferContext<C> & {
  /** Extra positional arguments not consumed by command path or flags */
  extraArgs: string[];
  /** Project root directory */
  cwd: string;
};

/**
 * Hook function type (for context-dependent pre-checks)
 *
 * Returns checks to execute based on the command context.
 * The returned checks are executed with their labels logged.
 */
export type HookFn<C extends ContextDef = ContextDef> = (
  ctx: HookContext<C>
) => Promise<CheckConfig | CheckConfig[] | void> | CheckConfig | CheckConfig[] | void;

/**
 * Context passed to run function
 */
export type RunContext<C extends ContextDef = ContextDef> = {
  /** Resolved context values from command flags */
  context: InferContext<C>;
  /** Extra positional arguments not consumed by command path or flags */
  extraArgs: string[];
  /** Project root directory */
  cwd: string;
};

/**
 * Run function type - receives a runner and context
 *
 * The runner is generic over the context, enabling type-safe task execution.
 * When calling r.run(task), TypeScript enforces that the command's context
 * satisfies the task's env resolver context requirements.
 */
export type RunFn<C extends ContextDef = ContextDef> = (
  runner: Runner<InferContext<C>>,
  ctx: RunContext<C>
) => Promise<void> | void;

/**
 * Run-all-children execution mode
 *
 * When set on a parent command, an "all" option appears in the submenu
 * that executes all leaf children in the specified mode.
 */
export type RunAllMode = 'sequential' | 'parallel';

/**
 * Command configuration
 */
export type CommandConfig<C extends ContextDef = ContextDef> = {
  /** Human-readable label for menus and help */
  label: string;

  /**
   * Alternative names for this command.
   *
   * Aliases allow users to invoke a command with shorter or alternative names.
   * Exact command names always take precedence over aliases.
   *
   * @example
   * ```ts
   * export const command = defineCommand({
   *   label: 'Deploy to environment',
   *   aliases: ['d', 'dep'],
   *   // ...
   * });
   *
   * // Now accessible via:
   * // mycli deploy --env staging
   * // mycli d --env staging
   * // mycli dep --env staging
   * ```
   */
  aliases?: string[];

  /** Context definitions - fields derived from flags */
  context?: C;

  /**
   * Pre-execution checks. Throw to abort.
   *
   * Can be:
   * - CheckConfig: A single check
   * - CheckConfig[]: An array of checks
   * - HookFn: A function that receives context and returns checks
   */
  pre?: CheckConfig | CheckConfig[] | HookFn<C>;

  /**
   * Default timeout in milliseconds for all exec() calls in this command.
   * Can be overridden per-exec via the `timeout` option.
   *
   * @default 300000 (5 minutes)
   */
  timeout?: number;

  /** Main execution function */
  run?: RunFn<C>;

  /**
   * Enable "run all children" option in the submenu.
   *
   * When set to 'sequential', all leaf children run one after another.
   * When set to 'parallel', all leaf children run concurrently.
   * When omitted, no "all" option is shown.
   *
   * Only meaningful for parent commands (those without a `run` function).
   */
  enableRunAllChildren?: RunAllMode;

  /**
   * When true, "run all children" captures stdout/stderr and shows a spinner.
   * Output is only shown on failure. When false, output streams to terminal.
   *
   * @default true
   */
  quietRunAll?: boolean;
};

/**
 * Define a command with type inference
 *
 * @example
 * ```ts
 * // Command with context - runner is typed with that context
 * export const command = defineCommand({
 *   label: 'Run migrations',
 *   context: {
 *     env: {
 *       from: 'flag',
 *       schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
 *       description: 'Target environment',
 *     },
 *   },
 *   run: async (r, ctx) => {
 *     // ctx.env is typed as 'dev' | 'staging' | 'prod'
 *     // ctx.args is string[]
 *     // Tasks requiring { env: string } context can be run
 *     await r.run(runMigration, { command: 'apply' });
 *   },
 * });
 *
 * // Command without context - runner has empty context
 * export const command = defineCommand({
 *   label: 'Format code',
 *   run: async (r, ctx) => {
 *     // Only tasks with no context requirements can be run
 *     // ctx.args is still available
 *     await r.exec('prettier --write .');
 *   },
 * });
 * ```
 */
export function defineCommand<C extends ContextDef>(config: CommandConfig<C>): CommandConfig<C> {
  return config;
}

/**
 * Loaded command with metadata
 */
export type LoadedCommand = {
  /** Command path (e.g., 'dev', 'generate.types.cloudflare') */
  path: string;
  /** Command segments (e.g., ['dev'], ['generate', 'types', 'cloudflare']) */
  segments: string[];
  /** Command configuration */
  config: CommandConfig;
  /** File path */
  file: string;
};

/**
 * Command tree node
 *
 * Represents a command and its children in a tree structure.
 * Built at startup for efficient navigation.
 */
export type CommandNode = {
  /** Full dot-notation path (e.g., 'generate.types') */
  path: string;
  /** Last segment of the path (e.g., 'types') */
  segment: string;
  /** Command configuration */
  config: CommandConfig;
  /** Child commands keyed by their segment */
  children: Map<string, CommandNode>;
};

/**
 * Root of the command tree
 *
 * Maps top-level command segments to their nodes.
 */
export type CommandTree = Map<string, CommandNode>;

// Re-export Runner type for convenience
export type { Runner } from './runner';
