export type ActivityId = string;
export type GroupId = string;

/**
 * Layout hints for groups - tells the UI how to arrange child activities
 */
export type GroupLayout = 'sequence' | 'parallel' | 'tabs' | 'grid';

/**
 * Log levels for log events
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'step';

/**
 * Activity update payload - flexible structure for progress, status, and custom data
 */
export type ActivityUpdatePayload = {
  progress?: number; // 0-100
  message?: string; // "Downloading..."
  [key: string]: unknown; // Custom data: { filesProcessed: 50, memory: '20mb' }
};

/**
 * The Discriminated Union of all possible CLI events
 */
export type CLIEvent =
  // --- Lifecycle ---
  | { type: 'root:start'; appName: string; version?: string }
  | { type: 'root:end'; exitCode: number }

  // --- Grouping (Layout Hints) ---
  // A group is a container for activities (e.g. parallel execution, tabs)
  | {
      type: 'group:start';
      id: GroupId;
      parentId?: GroupId;
      label: string;
      layout: GroupLayout;
    }
  | { type: 'group:end'; id: GroupId }

  // --- Activities (Units of Work) ---
  // Tasks, Commands, or sub-steps
  | {
      type: 'activity:start';
      id: ActivityId;
      parentId?: GroupId | ActivityId;
      label: string;
      meta?: Record<string, unknown>;
    }
  | {
      type: 'activity:success';
      id: ActivityId;
      result?: unknown;
    }
  | {
      type: 'activity:failure';
      id: ActivityId;
      error: Error | string;
      /** Remediation steps when the failure has fix instructions */
      remediation?: string[];
      /** Documentation URL for more information about the failure */
      documentationUrl?: string;
    }

  // --- The "Update" (Data) ---
  // Reactive state changes. The UI decides how to render this.
  | {
      type: 'activity:update';
      id: ActivityId;
      payload: ActivityUpdatePayload;
    }

  // --- The "Log" (Output) ---
  // Explicit request to append text to the history/stream
  | {
      type: 'log';
      activityId?: ActivityId;
      level: LogLevel;
      message: string;
    }

  // --- Reporter Control ---
  // Suspend/resume reporter output (for fullscreen takeover by TUI apps)
  | { type: 'reporter:suspend' }
  | { type: 'reporter:resume' };

/**
 * Type guards for event types
 */
export function isRootEvent(
  event: CLIEvent
): event is Extract<CLIEvent, { type: 'root:start' | 'root:end' }> {
  return event.type === 'root:start' || event.type === 'root:end';
}

export function isGroupEvent(
  event: CLIEvent
): event is Extract<CLIEvent, { type: 'group:start' | 'group:end' }> {
  return event.type === 'group:start' || event.type === 'group:end';
}

export function isActivityEvent(event: CLIEvent): event is Extract<
  CLIEvent,
  {
    type: 'activity:start' | 'activity:success' | 'activity:failure' | 'activity:update';
  }
> {
  return (
    event.type === 'activity:start' ||
    event.type === 'activity:success' ||
    event.type === 'activity:failure' ||
    event.type === 'activity:update'
  );
}

export function isLogEvent(event: CLIEvent): event is Extract<CLIEvent, { type: 'log' }> {
  return event.type === 'log';
}

import type { EventBus } from './bus.js';

/**
 * Event listener function type
 */
export type EventListener = (event: CLIEvent) => void;

/**
 * Unsubscribe function returned by `on()`
 */
export type Unsubscribe = () => void;

import type { ReporterAdapter, ReporterAdapterController } from './adapter.js';

export type { EventBus, ReporterAdapter, ReporterAdapterController };
