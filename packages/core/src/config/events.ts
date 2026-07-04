/**
 * CLI Event Types (re-exported)
 *
 * The "wire protocol" of the CLI lives in `../events`. This module re-exports
 * it so there is a single source of truth for event types.
 */

export type {
  ActivityId,
  GroupId,
  GroupLayout,
  LogLevel,
  ActivityUpdatePayload,
  CLIEvent,
  EventListener,
  Unsubscribe,
  EventBus,
} from '../events';

export { isRootEvent, isGroupEvent, isActivityEvent, isLogEvent } from '../events';
