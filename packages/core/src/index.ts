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
export { wrapScript } from './lib/wrap-script';
export type { WrapScriptConfig } from './lib/wrap-script';
export { defineTask } from './lib/task';
export { defineEnv, getEnvKeys } from './lib/env';
export { defineEnvResolver, validateResolverKeys, createStaticEnvResolver } from './lib/resolver';
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
  CommandConfigWithOutput,
  ContextDef,
  ContextFieldDef,
  ContextSource,
  InferContext,
  InferContextInput,
  InferContextOutput,
  RunContext,
  HookContext,
  HookFn,
  RunFn,
  OutputRunFn,
  FormatFn,
  RunAllMode,
  LoadedCommand,
  CommandNode,
  CommandTree,
  MountContext,
  MountResult,
  Mountable,
  MountableLike,
  OptionalizeUndefined,
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
  RunnerOptions,
  // Parallel execution options
  ParallelMode,
  ParallelOptions,
} from './lib/runner';

// =============================================================================
// Trust broker (pok broker wire protocol v1)
// =============================================================================

export {
  isBrokerEngaged,
  requestApproval,
  getBrokerSocketPath,
  detectInitiator,
  toApprovalContext,
  BrokerDeniedError,
  BROKER_PROTOCOL_VERSION,
  BROKER_APPROVAL_TIMEOUT_MS,
} from './lib/broker';
export type {
  ApprovalRequest,
  ApprovalResponse,
  ApprovalDecision,
  ApprovalInitiator,
  ApprovalAccess,
} from './lib/broker';

// =============================================================================
// Router
// =============================================================================

export { run, buildCommandTree, RouterError } from './lib/router';
export type { RouterConfig } from './lib/router';

// =============================================================================
// Cancellation
// =============================================================================

export { CancelError, CANCEL_EXIT_CODE } from './lib/cancel';

// =============================================================================
// CLI Error (with usage hints)
// =============================================================================

export { CLIError, generateUsageLine } from './lib/cli-error';
export type { ErrorContext } from './lib/cli-error';

// =============================================================================
// Error classification (operational vs. unexpected)
// =============================================================================

export {
  isOperationalError,
  markOperational,
  markPresented,
  wasPresented,
  OPERATIONAL_ERROR,
  PRESENTED_ERROR,
} from './lib/errors';
export type { OperationalError } from './lib/errors';

// =============================================================================
// Help generation
// =============================================================================

export { generateHelp, generateRootHelp, generateRecursiveHelp, hasHelpFlag } from './lib/help';
export type { HelpOptions, RootHelpOptions, RecursiveHelpOptions } from './lib/help';

// =============================================================================
// Utils - Shell
// =============================================================================

/**
 * Shell utilities for command execution and environment detection.
 *
 * Note: `shellRun` and `shellRunQuiet` are aliases for `run` and `runQuiet` from
 * the shell utilities module, renamed on export to avoid conflicting with the
 * router's `run` function (the CLI entry point).
 */
export {
  commandExists,
  getVersion,
  getNodeMajorVersion,
  run as shellRun,
  runQuiet as shellRunQuiet,
  detectPackageManagerFromUserAgent,
  detectPackageManagerFromUserAgent as getPackageManager,
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
  // Dynamic options types
  StaticSelectOptions,
  DynamicSelectOptions,
  OptionsProvider,
  // Other prompt types
  MultiselectOption,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
  AutocompleteOptions,
  // Navigator (menu presentation policy)
  Navigator,
  NavOption,
  NavResult,
  NavContext,
  // Raw Prompter (for testing and non-TTY environments)
  PromptCall,
  ResponseProvider,
  RawPrompterOptions,
  RawPrompter,
} from './prompter';

export { createRawPrompter, isDynamicOptions, createMenuNavigator } from './prompter';

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
export type { RunCliConfig } from './cli';

// =============================================================================
// Config
// =============================================================================

export * from './config';

// =============================================================================
// Plugins
// =============================================================================

export {
  compose,
  fromConfig,
  fromDirectory,
  fromStatic,
  fromPackageScripts,
  fromPackageCommands,
  resolveMountable,
} from './lib/plugins';

// =============================================================================
// History
// =============================================================================

export { loadHistory, appendHistory, clearHistory, formatEntryLabel } from './lib/history';
export type { HistoryEntry } from './lib/history';
