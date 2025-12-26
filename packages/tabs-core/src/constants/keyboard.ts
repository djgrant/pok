/**
 * Keyboard Constants for CLI Tabs
 *
 * Escape sequences and key mappings for terminal input handling.
 */

/**
 * Common terminal escape sequences for special keys.
 * Used when forwarding input to child processes in focus mode.
 */
export const KEY_SEQUENCES = {
  RETURN: '\n',
  TAB: '\t',
  BACKSPACE: '\x7f',
  DELETE: '\x1b[3~',
  ARROW_UP: '\x1b[A',
  ARROW_DOWN: '\x1b[B',
  ARROW_RIGHT: '\x1b[C',
  ARROW_LEFT: '\x1b[D',
} as const;

/**
 * Convert a Ctrl+key combination to its terminal escape sequence.
 * Ctrl+A = 1, Ctrl+B = 2, ..., Ctrl+Z = 26
 */
export function ctrlKeyToSequence(key: string): string | null {
  const code = key.toUpperCase().charCodeAt(0) - 64;
  if (code >= 1 && code <= 26) {
    return String.fromCharCode(code);
  }
  return null;
}

/**
 * Duration to show help hint on startup (in milliseconds).
 */
export const HELP_HINT_DURATION_MS = 5000;
