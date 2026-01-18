/**
 * CLI Events Module
 *
 * Provides the event-driven architecture for the CLI framework.
 * Events represent what happened, and adapters decide how to render them.
 */

// Event types
export type {
  ActivityId,
  GroupId,
  GroupLayout,
  LogLevel,
  ActivityUpdatePayload,
  CLIEvent,
} from './types';

export { isRootEvent, isGroupEvent, isActivityEvent, isLogEvent } from './types';

// Event bus
export type { EventBus, EventListener, Unsubscribe } from './types';
export { createEventBus } from './bus';

// Reporter (user-facing API for emitting events)
export type {
  Reporter,
  TaskReporter,
  CommandReporter,
  UpdatePayload,
  GroupOptions,
} from './reporter';
export { ScopedReporter, createRootReporter, emitRootEnd } from './reporter';

// Reporter Adapter (interface for output rendering implementations)
export type { ReporterAdapter, ReporterAdapterController } from './adapter';

// Raw Reporter Adapter (for testing)
export type {
  RawReporterAdapterOptions,
  RawReporterAdapterController,
  RawReporterAdapter,
} from './adapter.raw';
export { createRawReporterAdapter } from './adapter.raw';
