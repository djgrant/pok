/**
 * Hooks Index
 *
 * Re-exports all shared hooks for CLI tabs.
 */

export type { UseTabsStateOptions, TabsState, TabsActions } from './use-tabs-state.js';
export { useTabsState } from './use-tabs-state.js';

export type {
  KeyboardCallbacks,
  KeyboardState,
  NormalizedKeyEvent,
  KeyboardAction,
} from './use-keyboard-handler.js';
export {
  processKeyEvent,
  useKeyboardCallbackRefs,
  executeKeyboardAction,
} from './use-keyboard-handler.js';
