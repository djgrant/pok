/**
 * Types for tabs-ink
 *
 * Re-exports shared types from @pokjs/tabs-core and defines implementation-specific types.
 */

import type { ChildProcess } from 'node:child_process';
import type { TabProcess as BaseTabProcess } from '@pokjs/tabs-core';

// =============================================================================
// Re-exports from @pokjs/tabs-core
// =============================================================================

export type { TabStatus, ActivityNode, GroupNode, EventDrivenState } from '@pokjs/tabs-core';

export { MAX_OUTPUT_LINES } from '@pokjs/tabs-core';

// =============================================================================
// Implementation-specific types for tabs-ink
// =============================================================================

/**
 * Extended TabProcess with ChildProcess reference for process management.
 * This extends the base TabProcess from tabs-core with Ink-specific fields.
 */
export type TabProcess = BaseTabProcess & {
  /** Reference to the spawned child process (Ink-specific) */
  process?: ChildProcess;
};

/**
 * Props for the TabbedView component (UI-specific)
 */
export type TabbedViewProps = {
  tabs: TabProcess[];
  onQuit: () => void;
  onQuitRequest: () => void;
  quitConfirmPending: boolean;
};
