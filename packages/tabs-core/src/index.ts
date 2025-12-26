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

export { MAX_OUTPUT_LINES, STATUS_INDICATORS, getStatusIndicator } from './types.js';

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

export type { TabSpec, ProcessManagerCallbacks, ProcessManagerOptions } from './process-manager.js';

export { ProcessManager, OUTPUT_BATCH_MS } from './process-manager.js';

// =============================================================================
// Constants
// =============================================================================

export type { Shortcut, ShortcutGroup } from './constants/index.js';
export { HELP_CONTENT, KEY_SEQUENCES, ctrlKeyToSequence, HELP_HINT_DURATION_MS } from './constants/index.js';

// =============================================================================
// Hooks
// =============================================================================

export type {
  UseTabsStateOptions,
  TabsState,
  TabsActions,
  KeyboardCallbacks,
  KeyboardState,
  NormalizedKeyEvent,
  KeyboardAction,
} from './hooks/index.js';

export {
  useTabsState,
  processKeyEvent,
  useKeyboardCallbackRefs,
  executeKeyboardAction,
} from './hooks/index.js';
