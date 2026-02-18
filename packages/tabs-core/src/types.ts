/**
 * Shared Types for CLI Tabs
 *
 * Framework-agnostic types used by tabs adapters.
 */

import type { ActivityId, GroupId, GroupLayout } from '@pokit/core';

// =============================================================================
// Tab Process Types
// =============================================================================

export type TabStatus = 'running' | 'done' | 'error' | 'stopped';

export type TabProcess = {
  id: string;
  label: string;
  exec: string;
  output: string[];
  status: TabStatus;
  exitCode?: number;
};

export const MAX_OUTPUT_LINES = 10_000;
export const MAX_LINE_LENGTH = 5_000;
export const BUFFER_WARNING_THRESHOLD = 80; // Percentage

// =============================================================================
// Status Indicator Styling
// =============================================================================

/**
 * Status indicator configuration for tabs.
 *
 * Color scheme:
 * - running: green (active process)
 * - done: cyan (completed/inactive)
 * - error: red (failed)
 * - stopped: yellow (manually stopped)
 */
export type StatusIndicator = {
  color: string;
  colorBright: string;
  icon: string;
};

export const STATUS_INDICATORS: Record<TabStatus, StatusIndicator> = {
  running: { color: '#00AA00', colorBright: '#00FF00', icon: '●' },
  done: { color: '#00AAAA', colorBright: '#00FFFF', icon: '○' },
  error: { color: '#AA0000', colorBright: '#FF0000', icon: '✗' },
  stopped: { color: '#AAAA00', colorBright: '#FFFF00', icon: '■' },
};

export function getStatusIndicator(
  status: TabStatus,
  bright: boolean = false
): { color: string; icon: string } {
  const indicator = STATUS_INDICATORS[status];
  return {
    color: bright ? indicator.colorBright : indicator.color,
    icon: indicator.icon,
  };
}

// =============================================================================
// Event-Driven State Types
// =============================================================================

/**
 * Activity node in the state tree
 */
export type ActivityNode = {
  type: 'activity';
  id: ActivityId;
  parentId?: GroupId | ActivityId;
  label: string;
  status: 'running' | 'success' | 'failure';
  progress?: number;
  message?: string;
  meta?: Record<string, unknown>;
  logs: Array<{ level: string; message: string }>;
};

/**
 * Group node in the state tree
 */
export type GroupNode = {
  type: 'group';
  id: GroupId;
  parentId?: GroupId;
  label: string;
  layout: GroupLayout;
  children: Array<ActivityId | GroupId>;
};

/**
 * Root state for the event-driven CLI
 */
export type EventDrivenState = {
  appName?: string;
  version?: string;
  exitCode?: number;
  activities: Map<ActivityId, ActivityNode>;
  groups: Map<GroupId, GroupNode>;
  rootChildren: Array<ActivityId | GroupId>;
};
