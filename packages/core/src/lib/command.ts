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
import type { Reporter, CommandReporter } from '../events';
import type { Prompter } from '../prompter';
import type { OptionsRequest } from '../prompter';

type ResolvePrimitive = string | number | boolean;
export type ResolveOption = ResolvePrimitive | { value: ResolvePrimitive; label?: string };
export type ResolveOptionsPage = {
  options: ResolveOption[];
  nextCursor?: string | null;
  totalCount?: number;
};
export type ResolveOptionsResult = ResolveOption[] | ResolveOptionsPage;

// =============================================================================
// Plugin / Mount Types
// =============================================================================

/**
 * Context provided to a mountable during mounting
 */
export type MountContext = {
  /** Project root directory */
  projectRoot: string;
  /** Reporter for emitting events */
  reporter: Reporter;
  /** Prompter for interactive input */
  prompter: Prompter;
  /** The path where the mountable is being mounted (e.g. ['admin']) */
  path: string[];
  /** The router configuration (typed as any to avoid cycles) */
  config: any;
  /** Arbitrary context data */
  [key: string]: any;
};

/**
 * Result of mounting a plugin
 */
export type MountResult = {
  /**
   * The command tree to merge into the parent.
   * Root keys become children of the mounting command.
   */
  tree: CommandTree;

  /**
   * Unique ID for cycle detection.
   * Must be deterministic based on the source (path, config, etc).
   */
  mountSourceId: string;
};

/**
 * A function that produces a MountResult (or a promise of one)
 */
export type Mountable = (context: MountContext) => MountResult | Promise<MountResult>;

/**
 * Something that can be mounted: a Mountable function or a lazy factory
 */
export type MountableLike = Mountable | ((context: MountContext) => Mountable | Promise<Mountable>);

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

  from: 'flag';

  /** Zod schema for validation and type inference */

  schema: z.ZodType;

  /**
   * Optional dynamic resolver for interactive option loading.
   *
   * Supports either:
   * - direct options/page result
   * - paginated loading via request cursor/filter
   * - async iterator yielding option pages
   */
  resolve?: (
    request: OptionsRequest,
    context: Record<string, unknown>
  ) =>
    | ResolveOptionsResult
    | Promise<ResolveOptionsResult>
    | AsyncIterable<ResolveOptionsResult>;

  /**
   * Context fields that must be resolved before this field.
   *
   * Useful for cascading selects, e.g. `db` depending on selected `env`.
   */
  dependsOn?: string[];

  /** Human-readable description for help text */

  description?: string;

  /**
   * Alternative flag names for this context field.
   *
   * @example
   * ```ts
   * epicRef: {
   *   from: 'flag',
   *   schema: z.string(),
   *   aliases: ['id', 'slug'],
   * }
   * ```
   */
  aliases?: string[];

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

  /**
   * Group name for collapsing boolean flags into a single multiselect prompt.
   *
   * When multiple boolean fields share the same group name, they are presented
   * as a single multiselect prompt (checked = true, unchecked = false) instead
   * of individual confirm prompts. Only applies to boolean schema fields.
   *
   * @example
   * ```ts
   * verbose: {
   *   from: 'flag',
   *   schema: z.boolean().default(false),
   *   description: 'Enable verbose output',
   *   group: 'Options',
   * },
   * dryRun: {
   *   from: 'flag',
   *   schema: z.boolean().default(false),
   *   description: 'Dry run mode',
   *   group: 'Options',
   * },
   * ```
   */
  group?: string;

  /**
   * Group enum choices for visual grouping in select prompts.
   *
   * Maps group labels to arrays of choice values. Options are displayed
   * under their group headers (like HTML `<optgroup>`).
   *
   * @example
   * ```ts
   * environment: {
   *   from: 'flag',
   *   schema: z.enum(['dev-local', 'dev-cloud', 'staging', 'prod-us', 'prod-eu']),
   *   description: 'Target environment',
   *   choiceGroups: {
   *     'Development': ['dev-local', 'dev-cloud'],
   *     'Staging': ['staging'],
   *     'Production': ['prod-us', 'prod-eu'],
   *   },
   * }
   * ```
   */
  choiceGroups?: Record<string, string[]>;
};

/**
 * Context definition - a record of field definitions or literal values
 */
export type ContextDef = Record<string, ContextFieldDef | string | number | boolean>;

/**
 * Check if a value is a ContextFieldDef (vs a static literal value)
 */
export function isContextFieldDef(value: unknown): value is ContextFieldDef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'from' in value &&
    (value as any).from === 'flag' &&
    'schema' in value
  );
}

/**
 * Infer the resolved context type from a context definition
 *
 * Extracts the Zod-inferred type for fields, and the literal type for static values.
 */
export type InferContext<C extends ContextDef> = {
  [K in keyof C]: C[K] extends ContextFieldDef ? z.infer<C[K]['schema']> : C[K];
};

/**
 * Infer the accepted input context type from a context definition.
 *
 * This uses z.input<schema> so transforms/preprocesses accept their input shapes.
 */
export type InferContextInput<C extends ContextDef> = {
  [K in keyof C]: C[K] extends ContextFieldDef ? z.input<C[K]['schema']> : C[K];
};

/** Alias for the resolved (output) context type. */
export type InferContextOutput<C extends ContextDef> = InferContext<C>;

/**
 * Turn properties that allow undefined into optional properties.
 *
 * Useful for SDK-facing "context input" objects where defaults may apply.
 */
export type OptionalizeUndefined<T extends Record<string, unknown>> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

/**
 * Context passed to hooks
 */
export type HookContext<C extends ContextDef = any> = InferContext<C> & {
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
export type HookFn<C extends ContextDef = any> = (
  ctx: HookContext<C>
) => Promise<CheckConfig | CheckConfig[] | void> | CheckConfig | CheckConfig[] | void;

/**
 * Context passed to run function
 */
export type RunContext<C extends ContextDef = any> = {
  /** Resolved context values from command flags */
  context: InferContext<C>;
  /** Resolved app-level/global context values */
  globalContext?: Record<string, unknown>;
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
export type RunFn<C extends ContextDef = any> = (
  runner: Runner<InferContext<C>>,
  ctx: RunContext<C>
) => Promise<void> | void;

/**
 * Run function type for commands with output schemas.
 * Returns typed data matching the output schema.
 */
export type OutputRunFn<C extends ContextDef = any, O extends z.ZodType = z.ZodType> = (
  runner: Runner<InferContext<C>>,
  ctx: RunContext<C>
) => Promise<z.infer<O>> | z.infer<O>;

/**
 * Format function type for human-readable output.
 * Receives typed data and a reporter for rendering.
 */
export type FormatFn<O extends z.ZodType = z.ZodType> = (
  data: z.infer<O>,
  reporter: CommandReporter
) => void;

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
   * Extended description for help text.
   *
   * Unlike `label` which is short and used in menus, `description` provides
   * detailed documentation about what the command does.
   *
   * @example
   * ```ts
   * export const command = defineCommand({
   *   label: 'Deploy to environment',
   *   description: 'Deploys the application to the specified environment. ' +
   *                'Runs migrations, updates configs, and restarts services.',
   *   // ...
   * });
   * ```
   */
  description?: string;

  /**
   * Example invocations shown in help text.
   *
   * Provide real-world examples of how to use this command.
   * These are displayed in the `--help` output to help users understand usage.
   *
   * @example
   * ```ts
   * export const command = defineCommand({
   *   label: 'Deploy to environment',
   *   examples: [
   *     'mycli deploy --env prod',
   *     'mycli deploy --env staging --dry-run',
   *   ],
   *   // ...
   * });
   * ```
   */
  examples?: string[];

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
   * Output schema for typed, structured command output.
   * 
   * When defined, the framework:
   * - Infers the return type of `run` from this schema
   * - Auto-injects a `--format` flag (json, table, csv)
   * - Routes structured data to stdout (parsable) separate from reporter logs (stderr)
   * 
   * @example
   * ```ts
   * output: z.object({
   *   tasks: z.array(z.object({ id: z.string(), title: z.string() })),
   * }),
   * ```
   */
  output?: z.ZodType;

  /**
   * Human-readable format function for structured output.
   * 
   * Called when no `--format` flag is specified (default human display).
   * Receives the typed data returned by `run` and a reporter for rendering.
   * If omitted, falls back to JSON output.
   * 
   * @example
   * ```ts
   * format(data, r) {
   *   for (const t of data.tasks) {
   *     r.info(`${t.id}  ${t.title}`);
   *   }
   * },
   * ```
   */
  format?: (data: any, reporter: CommandReporter) => void;

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

  /**
   * When true, unknown flags are not rejected and are instead passed
   * to the command in `extraArgs`.
   *
   * @default false
   */
  ignoreUnknownFlags?: boolean;

  /**
   * When true, this command expects additional arguments to be provided.
   * If invoked without arguments from the menu, the user will be prompted to enter them.
   *
   * @default false
   */
  requestArgs?: boolean;

  /**
   * Mount a dynamic subcommand tree.
   *
   * A mountable function (or factory) that produces children for this command.
   * This is the primary mechanism for plugins and composition.
   */
  mount?: MountableLike;
};

/**
 * Command configuration for commands with an output schema, preserving the schema type.
 *
 * This is primarily used for SDK typing (e.g. CommandReturn<typeof command>).
 */
export type CommandConfigWithOutput<C extends ContextDef, O extends z.ZodType> = Omit<
  CommandConfig<C>,
  'output' | 'run' | 'format'
> & {
  output: O;
  format?: FormatFn<O>;
  run?: OutputRunFn<C, O>;
};

/**
 * Define a command with output schema - run must return typed data
 */
export function defineCommand<C extends ContextDef, O extends z.ZodType>(
  config: Omit<CommandConfig<C>, 'run' | 'format'> & {
    output: O;
    format?: FormatFn<O>;
    run?: OutputRunFn<C, O>;
  }
): CommandConfigWithOutput<C, O>;

/**
 * Define a command without output schema - run returns void
 */
export function defineCommand<C extends ContextDef>(
  config: CommandConfig<C>
): CommandConfig<C>;

/**
 * Define a command with type inference
 *
 * @example
 * ```ts
 * // Command with output schema - typed return value
 * export const command = defineCommand({
 *   label: 'List tasks',
 *   output: z.object({ tasks: z.array(taskSchema) }),
 *   format(data, r) {
 *     for (const t of data.tasks) r.info(`${t.id}  ${t.title}`);
 *   },
 *   run: async (r, ctx) => {
 *     return { tasks };  // Must match output schema
 *   },
 * });
 *
 * // Command without output - returns void
 * export const command = defineCommand({
 *   label: 'Deploy',
 *   run: async (r) => {
 *     await r.exec('deploy.sh');
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
  /** Full path segments (e.g., ['generate', 'types']) */
  path: string[];
  /** Last segment of the path (e.g., 'types') */
  segment: string;
  /** Command configuration */
  config: CommandConfig;
  /** Child commands keyed by their segment */
  children: Map<string, CommandNode>;
  /** Provenance: where this node came from (plugin ID, directory, etc.) */
  source?: string;
  /** Absolute path to the source module, when known (used for SDK codegen). */
  file?: string;
  /** Optional project root override for this subtree */
  projectRoot?: string;
};

/**
 * Root of the command tree
 *
 * Maps top-level command segments to their nodes.
 */
export type CommandTree = Map<string, CommandNode>;

// Re-export Runner type for convenience
export type { Runner } from './runner';
