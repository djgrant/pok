import type { ChildProcess } from 'node:child_process';
import type { ActivityId, GroupId, GroupLayout } from '@openpok/core';

export type TabStatus = 'running' | 'done' | 'error' | 'stopped';

export type TabProcess = {
  id: string;
  label: string;
  exec: string;
  output: string[];
  status: TabStatus;
  exitCode?: number;
  process?: ChildProcess;
};

export type TabbedViewProps = {
  tabs: TabProcess[];
  onQuit: () => void;
  onQuitRequest: () => void;
  quitConfirmPending: boolean;
};

export const MAX_OUTPUT_LINES = 10_000;

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
