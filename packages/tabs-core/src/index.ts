/**
 * @openpok/tabs-core
 *
 * Shared logic for CLI tabs adapters (Ink, OpenTUI).
 * Framework-agnostic types, state management, and process handling.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  TabStatus,
  TabProcess,
  StatusIndicator,
  ActivityNode,
  GroupNode,
  EventDrivenState,
} from './types.js';

export {
  MAX_OUTPUT_LINES,
  STATUS_INDICATORS,
  getStatusIndicator,
} from './types.js';

// =============================================================================
// State Reducer
// =============================================================================

export {
  createInitialState,
  reducer,
  getTabsGroupActivities,
  findTabsGroup,
} from './state-reducer.js';

// =============================================================================
// Process Manager
// =============================================================================

export type {
  TabSpec,
  ProcessManagerCallbacks,
  ProcessManagerOptions,
} from './process-manager.js';

export { ProcessManager, OUTPUT_BATCH_MS } from './process-manager.js';
