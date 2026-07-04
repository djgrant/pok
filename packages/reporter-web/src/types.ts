/**
 * Reporter Web Types
 *
 * State shape definitions for the web reporter store.
 * Designed for React integration via useSyncExternalStore.
 */

import type { ActivityId, GroupId, GroupLayout, LogLevel } from '@pokit/core';

/**
 * Root lifecycle status
 */
export type RootStatus = 'idle' | 'running' | 'complete' | 'error';

/**
 * Activity status
 */
export type ActivityStatus = 'pending' | 'running' | 'success' | 'failure';

/**
 * Temporal markers for animation hints
 * These auto-clear after a short delay (600ms) to enable smooth UI transitions
 */
export type TemporalMarkers = {
  /** Activity just started (for entrance animations) */
  justStarted?: boolean;
  /** Activity just completed successfully (for success animations) */
  justCompleted?: boolean;
  /** Activity just failed (for error animations) */
  justFailed?: boolean;
  /** Group just started */
  justStartedGroup?: boolean;
  /** Group just ended */
  justEnded?: boolean;
};

/**
 * Activity state - represents a unit of work
 */
export type ActivityState = TemporalMarkers & {
  id: ActivityId;
  parentId?: GroupId | ActivityId;
  label: string;
  status: ActivityStatus;
  /** Progress 0-100 */
  progress?: number;
  /** Current status message */
  message?: string;
  /** Custom metadata */
  meta?: Record<string, unknown>;
  /** Error information if failed */
  error?: {
    message: string;
    remediation?: string[];
    documentationUrl?: string;
  };
  /** Custom payload data from updates */
  payload?: Record<string, unknown>;
  /** Timestamp when started */
  startedAt: number;
  /** Timestamp when completed (success or failure) */
  completedAt?: number;
};

/**
 * Group state - represents a container for activities
 */
export type GroupState = TemporalMarkers & {
  id: GroupId;
  parentId?: GroupId;
  label: string;
  layout: GroupLayout;
  /** Child activity IDs in order */
  activityIds: ActivityId[];
  /** Child group IDs in order */
  childGroupIds: GroupId[];
  /** Whether any child has failed */
  hasFailure: boolean;
  /** Timestamp when started */
  startedAt: number;
  /** Timestamp when ended */
  endedAt?: number;
};

/**
 * Log entry
 */
export type LogEntry = {
  id: string;
  activityId?: ActivityId;
  level: LogLevel;
  message: string;
  timestamp: number;
};

/**
 * Root state for the reporter
 */
export type RootState = {
  appName?: string;
  version?: string;
  status: RootStatus;
  startedAt?: number;
  endedAt?: number;
  exitCode?: number;
};

/**
 * Complete reporter state
 */
export type ReporterState = {
  /** Root lifecycle state */
  root: RootState;
  /** Groups indexed by ID */
  groups: Map<GroupId, GroupState>;
  /** Activities indexed by ID */
  activities: Map<ActivityId, ActivityState>;
  /** Log entries in chronological order */
  logs: LogEntry[];
  /** Whether reporter output is suspended */
  suspended: boolean;
};

/**
 * Subscription callback type
 */
export type StateListener = () => void;

/**
 * Reporter store interface compatible with useSyncExternalStore
 */
export type ReporterStore = {
  /** Get current state snapshot */
  getState(): ReporterState;
  /** Get snapshot for useSyncExternalStore (same as getState for immutable updates) */
  getSnapshot(): ReporterState;
  /** Subscribe to state changes */
  subscribe(listener: StateListener): () => void;
  /** Get server snapshot for SSR (returns same as getSnapshot) */
  getServerSnapshot(): ReporterState;
};
