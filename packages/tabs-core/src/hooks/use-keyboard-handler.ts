/**
 * Shared Keyboard Handler Logic
 *
 * Framework-agnostic keyboard action handling for tabbed terminal interfaces.
 * Provides normalized keyboard actions that can be called by framework-specific handlers.
 */

import { useRef, useEffect } from 'react';
import { KEY_SEQUENCES, ctrlKeyToSequence } from '../constants/keyboard.js';

/**
 * Callbacks for keyboard actions in the tabbed view.
 */
export type QuitReason = 'user' | 'interrupt';

export type KeyboardCallbacks = {
  onQuit: (reason: QuitReason) => void;
  onQuitRequest: () => void;
  onRestart: (index: number) => void;
  onKill: (index: number) => void;
  onEnterFocusMode: () => void;
  onExitFocusMode: () => void;
  onSendInput: (data: string) => void;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
};

/**
 * Current state needed for keyboard handling decisions.
 */
export type KeyboardState = {
  helpVisible: boolean;
  focusMode: boolean;
  quitConfirmPending: boolean;
  activeIndex: number;
  tabCount: number;
};

/**
 * Normalized key event structure.
 * Provides a unified interface for different terminal keyboard APIs.
 */
export type NormalizedKeyEvent = {
  /** The character(s) typed, if any */
  char?: string;
  /** Named key (e.g., 'escape', 'tab', 'up', 'down') */
  name?: string;
  /** Whether Ctrl was held */
  ctrl?: boolean;
  /** Whether Shift was held */
  shift?: boolean;
  /** Whether Meta/Alt was held */
  meta?: boolean;
};

/**
 * Action results from keyboard handling.
 */
export type KeyboardAction =
  | { type: 'toggle-help' }
  | { type: 'close-help' }
  | { type: 'exit-focus-mode' }
  | { type: 'send-input'; data: string }
  | { type: 'quit'; reason: QuitReason }
  | { type: 'quit-request' }
  | { type: 'cancel-quit' }
  | { type: 'enter-focus-mode' }
  | { type: 'restart'; index: number }
  | { type: 'kill'; index: number }
  | { type: 'switch-tab'; index: number }
  | { type: 'next-tab' }
  | { type: 'prev-tab' }
  | { type: 'scroll'; delta: number }
  | { type: 'none' };

/**
 * Process a normalized key event and return the appropriate action.
 *
 * This is the core keyboard handling logic, extracted to be framework-agnostic.
 * Each adapter normalizes keyboard events and calls this function.
 */
export function processKeyEvent(
  event: NormalizedKeyEvent,
  state: KeyboardState,
  viewHeight: number
): KeyboardAction {
  const { char, name, ctrl, shift, meta } = event;
  const { helpVisible, focusMode, quitConfirmPending, activeIndex, tabCount } = state;

  // Help toggle takes priority
  if (char === '?') {
    return { type: 'toggle-help' };
  }

  // Escape closes help if visible
  if (name === 'escape' && helpVisible) {
    return { type: 'close-help' };
  }

  // Don't process other keys when help is visible
  if (helpVisible) {
    return { type: 'none' };
  }

  // Focus mode: forward most input to child process
  if (focusMode) {
    if (name === 'escape') {
      return { type: 'exit-focus-mode' };
    }

    const rawInput = getFocusModeInput(event);
    if (rawInput) {
      return { type: 'send-input', data: rawInput };
    }
    return { type: 'none' };
  }

  // Normal mode: handle UI navigation

  // Quit confirmation handling
  if (quitConfirmPending) {
    if (char === 'q' || name === 'q') {
      return { type: 'quit', reason: 'user' };
    }
    return { type: 'cancel-quit' };
  }

  // Quit request
  if (char === 'q' || name === 'q') {
    return { type: 'quit-request' };
  }

  // Ctrl+C for instant quit
  if ((char === 'c' || name === 'c') && ctrl) {
    return { type: 'quit', reason: 'interrupt' };
  }

  // Enter focus/input mode
  if (char === 'i' || name === 'i') {
    return { type: 'enter-focus-mode' };
  }

  // Restart current tab
  if (char === 'r' || name === 'r') {
    return { type: 'restart', index: activeIndex };
  }

  // Kill current tab's process
  if (char === 'k' || name === 'k') {
    return { type: 'kill', index: activeIndex };
  }

  // Number keys 1-9 for direct tab access
  const input = char || name || '';
  const num = parseInt(input, 10);
  if (num >= 1 && num <= tabCount) {
    return { type: 'switch-tab', index: num - 1 };
  }

  // Tab navigation
  if (name === 'tab' && shift) {
    return { type: 'prev-tab' };
  }
  if (name === 'tab') {
    return { type: 'next-tab' };
  }

  // Arrow key tab navigation (with meta)
  if ((name === 'left' || name === 'leftArrow') && meta) {
    return { type: 'prev-tab' };
  }
  if ((name === 'right' || name === 'rightArrow') && meta) {
    return { type: 'next-tab' };
  }

  // Scrolling
  if (name === 'up' || name === 'upArrow') {
    return { type: 'scroll', delta: -1 };
  }
  if (name === 'down' || name === 'downArrow') {
    return { type: 'scroll', delta: 1 };
  }
  if (name === 'pageup' || name === 'pageUp') {
    return { type: 'scroll', delta: -viewHeight };
  }
  if (name === 'pagedown' || name === 'pageDown') {
    return { type: 'scroll', delta: viewHeight };
  }

  return { type: 'none' };
}

/**
 * Get the raw input to send to child process when in focus mode.
 */
function getFocusModeInput(event: NormalizedKeyEvent): string | null {
  const { char, name, ctrl } = event;

  // Map special keys to escape sequences
  if (name === 'return') return KEY_SEQUENCES.RETURN;
  if (name === 'tab') return KEY_SEQUENCES.TAB;
  if (name === 'backspace') return KEY_SEQUENCES.BACKSPACE;
  if (name === 'delete') return KEY_SEQUENCES.DELETE;
  if (name === 'up' || name === 'upArrow') return KEY_SEQUENCES.ARROW_UP;
  if (name === 'down' || name === 'downArrow') return KEY_SEQUENCES.ARROW_DOWN;
  if (name === 'right' || name === 'rightArrow') return KEY_SEQUENCES.ARROW_RIGHT;
  if (name === 'left' || name === 'leftArrow') return KEY_SEQUENCES.ARROW_LEFT;

  // Ctrl+key combinations
  if (ctrl && name && name.length === 1) {
    return ctrlKeyToSequence(name);
  }

  // Regular character input
  if (char) {
    return char;
  }

  return null;
}

/**
 * Hook to create stable references for keyboard callbacks.
 *
 * This solves the common React issue where callbacks in keyboard handlers
 * may have stale closures. The refs always point to the current callback.
 */
export function useKeyboardCallbackRefs(callbacks: KeyboardCallbacks) {
  const onQuitRef = useRef(callbacks.onQuit);
  const onQuitRequestRef = useRef(callbacks.onQuitRequest);
  const onRestartRef = useRef(callbacks.onRestart);
  const onKillRef = useRef(callbacks.onKill);
  const onEnterFocusModeRef = useRef(callbacks.onEnterFocusMode);
  const onExitFocusModeRef = useRef(callbacks.onExitFocusMode);
  const onSendInputRef = useRef(callbacks.onSendInput);
  const onToggleHelpRef = useRef(callbacks.onToggleHelp);
  const onCloseHelpRef = useRef(callbacks.onCloseHelp);

  useEffect(() => {
    onQuitRef.current = callbacks.onQuit;
    onQuitRequestRef.current = callbacks.onQuitRequest;
    onRestartRef.current = callbacks.onRestart;
    onKillRef.current = callbacks.onKill;
    onEnterFocusModeRef.current = callbacks.onEnterFocusMode;
    onExitFocusModeRef.current = callbacks.onExitFocusMode;
    onSendInputRef.current = callbacks.onSendInput;
    onToggleHelpRef.current = callbacks.onToggleHelp;
    onCloseHelpRef.current = callbacks.onCloseHelp;
  }, [callbacks]);

  return {
    onQuitRef,
    onQuitRequestRef,
    onRestartRef,
    onKillRef,
    onEnterFocusModeRef,
    onExitFocusModeRef,
    onSendInputRef,
    onToggleHelpRef,
    onCloseHelpRef,
  };
}

/**
 * Execute a keyboard action using the provided callback refs.
 */
export function executeKeyboardAction(
  action: KeyboardAction,
  refs: ReturnType<typeof useKeyboardCallbackRefs>,
  scrollBy: (delta: number) => void,
  switchTab: (index: number) => void,
  nextTab: () => void,
  prevTab: () => void
): void {
  switch (action.type) {
    case 'toggle-help':
      refs.onToggleHelpRef.current();
      break;
    case 'close-help':
      refs.onCloseHelpRef.current();
      break;
    case 'exit-focus-mode':
      refs.onExitFocusModeRef.current();
      break;
    case 'send-input':
      refs.onSendInputRef.current(action.data);
      break;
    case 'quit':
      refs.onQuitRef.current(action.reason);
      break;
    case 'quit-request':
    case 'cancel-quit':
      refs.onQuitRequestRef.current();
      break;
    case 'enter-focus-mode':
      refs.onEnterFocusModeRef.current();
      break;
    case 'restart':
      refs.onRestartRef.current(action.index);
      break;
    case 'kill':
      refs.onKillRef.current(action.index);
      break;
    case 'switch-tab':
      switchTab(action.index);
      break;
    case 'next-tab':
      nextTab();
      break;
    case 'prev-tab':
      prevTab();
      break;
    case 'scroll':
      scrollBy(action.delta);
      break;
    case 'none':
      // Do nothing
      break;
  }
}
