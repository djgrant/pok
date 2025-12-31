/**
 * @pokit/core - File-based CLI framework
 *
 * A framework for building CLIs with file-based command routing,
 * declarative command definitions, and type-safe task execution.
 */

// =============================================================================
// Core definitions
// =============================================================================

export { defineCommand } from './lib/command';
export { defineTask } from './lib/task';
export { defineEnv, getEnvKeys } from './lib/env';
export { defineEnvResolver, validateResolverKeys } from './lib/resolver';
export { defineCompositeResolver } from './lib/resolver.composite';
export { defineCheck, CheckError } from './lib/check';

// =============================================================================
// Dry Run Pattern
// =============================================================================

export { dryRunContext, createDryRunReporter } from './lib/dry-run';
export type { WithDryRun, DryRunReporter } from './lib/dry-run';

// =============================================================================
// Command types
// =============================================================================

export type {
  CommandConfig,
  ContextDef,
  ContextFieldDef,
  ContextSource,
  InferContext,
  RunContext,
  HookContext,
  HookFn,
  RunFn,
  RunAllMode,
  LoadedCommand,
  CommandNode,
  CommandTree,
} from './lib/command';

// =============================================================================
// Args (context parsing)
// =============================================================================

export {
  getSchemaInfo,
  getEnumChoicesFromSchema,
  extractEnumChoices,
  extractChoices,
  unwrapSchema,
} from './lib/args';
export type { SchemaInfo } from './lib/args';

// =============================================================================
// Task types
// =============================================================================

export type {
  ExecTaskConfig,
  RunTaskConfig,
  TaskContext,
  AnyTaskConfig,
  WriteEnvsFn,
  InferTaskContext,
  InferTaskEnvs,
  InferTaskParams,
  InferTaskReturn,
  // Exec input types (for type annotations)
  ExecInput,
  ShellPromise,
  // Retry configuration
  RetryConfig,
  BackoffStrategy,
} from './lib/task';

export { isShellPromise, execInputToString, BackoffStrategies } from './lib/task';

// =============================================================================
// Environment types
// =============================================================================

export type { Env, InferEnvVars, InferEnvContext } from './lib/env';
export type {
  EnvResolver,
  AnyEnvResolver,
  TypedEnvResolver,
  EnvVarKey,
  ResolverResult,
  InferResolverContext,
  InferResolverVars,
} from './lib/resolver';

// =============================================================================
// Check types
// =============================================================================

export type { CheckConfig, CheckFn } from './lib/check';

// =============================================================================
// Runner
// =============================================================================

export { createRunner, CommandError, TimeoutError, AbortError, ParallelModes } from './lib/runner';
export type {
  Runner,
  ExecOptions,
  Command,
  RunnerItem,
  DeferredTask,
  TabsRunnerOptions,
  RunnerOptions,
  // Parallel execution options
  ParallelMode,
  ParallelOptions,
} from './lib/runner';

// =============================================================================
// Router
// =============================================================================

export { run, buildCommandTree, RouterError } from './lib/router';
export type { RouterConfig } from './lib/router';

// =============================================================================
// CLI Error (with usage hints)
// =============================================================================

export { CLIError, generateUsageLine } from './lib/cli-error';
export type { ErrorContext } from './lib/cli-error';

// =============================================================================
// Help generation
// =============================================================================

export { generateHelp, generateRootHelp, hasHelpFlag } from './lib/help';
export type { HelpOptions, RootHelpOptions } from './lib/help';

// =============================================================================
// Utils - Shell
// =============================================================================

/**
 * Shell utilities for command execution and environment detection.
 *
 * Note: `shellRun` and `shellRunQuiet` are aliases for `run` and `runQuiet` from
 * the shell utilities module. They are renamed on export to avoid naming conflicts
 * with the router's `run` function. These functions execute shell commands directly,
 * while the router's `run` function is the CLI entry point.
 *
 * Alternative naming considerations:
 * - `execShell` / `execShellQuiet` - More explicit about shell execution
 * - `runShell` / `runShellQuiet` - Maintains "run" naming but clarifies context
 *
 * The current `shellRun` naming follows the pattern of prefixing with the module
 * context to disambiguate from other `run` functions in the codebase.
 */
export {
  commandExists,
  getVersion,
  getNodeMajorVersion,
  run as shellRun,
  runQuiet as shellRunQuiet,
  getPackageManager,
} from './utils/shell';

// =============================================================================
// Events (Event-driven architecture)
// =============================================================================

export type {
  // Event types
  ActivityId,
  GroupId,
  GroupLayout,
  LogLevel,
  ActivityUpdatePayload,
  CLIEvent,
  // Event bus
  EventBus,
  EventListener,
  Unsubscribe,
  // Reporter (user-facing API)
  Reporter,
  TaskReporter,
  CommandReporter,
  UpdatePayload,
  GroupOptions,
  // Reporter Adapter (output rendering interface)
  ReporterAdapter,
  ReporterAdapterController,
  // Raw Reporter Adapter (for testing)
  RawReporterAdapterOptions,
  RawReporterAdapterController,
  RawReporterAdapter,
} from './events';

export {
  isRootEvent,
  isGroupEvent,
  isActivityEvent,
  isLogEvent,
  createEventBus,
  ScopedReporter,
  createRootReporter,
  emitRootEnd,
  createRawReporterAdapter,
} from './events';

// =============================================================================
// Prompter (Interactive input interface)
// =============================================================================

export type {
  Prompter,
  SelectOption,
  SelectOptions,
  MultiselectOption,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
  // Raw Prompter (for testing and non-TTY environments)
  PromptCall,
  ResponseProvider,
  RawPrompterOptions,
  RawPrompter,
} from './prompter';

export { createRawPrompter } from './prompter';

// =============================================================================
// Tabs (Tabbed terminal UI interface)
// =============================================================================

export type { TabsAdapter, TabSpec, TabsOptions } from './tabs';

// =============================================================================
// Output Configuration
// =============================================================================

export { detectOutputConfig, extractOutputFlags, OUTPUT_FLAGS } from './lib/output-config';
export type { OutputConfig } from './lib/output-config';

// =============================================================================
// String Distance (Typo Detection)
// =============================================================================

export { levenshtein, findClosestMatch } from './lib/string-distance';

// =============================================================================
// CLI entry point
// =============================================================================

export { runCli } from './cli';
