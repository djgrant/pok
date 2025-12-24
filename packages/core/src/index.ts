/**
 * @openpok/core - File-based CLI framework
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
export { defineEnvResolver } from './lib/resolver';
export { defineCompositeResolver } from './lib/resolver.composite';
export { defineCheck } from './lib/check';

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
} from './lib/task';

// =============================================================================
// Environment types
// =============================================================================

export type { Env, InferEnvVars, InferEnvContext } from './lib/env';
export type {
  EnvResolver,
  AnyEnvResolver,
  TypedEnvResolver,
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

export { createRunner, CommandError } from './lib/runner';
export type {
  Runner,
  ExecOptions,
  Command,
  RunnerItem,
  DeferredTask,
  TabsRunnerOptions,
  RunnerOptions,
} from './lib/runner';

// =============================================================================
// Router
// =============================================================================

export { run, buildCommandTree, RouterError } from './lib/router';
export type { RouterConfig } from './lib/router';

// =============================================================================
// Utils - Shell
// =============================================================================

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
// CLI entry point
// =============================================================================

export { runCli } from './cli';
