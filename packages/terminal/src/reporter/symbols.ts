/**
 * Symbol Sets for CLI Output
 *
 * Provides Unicode and ASCII symbol sets for terminal output.
 * The appropriate set is selected based on OutputConfig.
 */

import type { OutputConfig } from '@pokit/core';

/**
 * Complete set of symbols used in CLI output
 */
export type SymbolSet = {
  /** Success indicator (e.g., checkmark) */
  success: string;
  /** Error indicator (e.g., X mark) */
  error: string;
  /** Warning indicator */
  warning: string;
  /** Info indicator */
  info: string;
  /** Step/progress indicator */
  step: string;
  /** Group start (e.g., top-left corner) */
  groupStart: string;
  /** Group end (e.g., bottom-left corner) */
  groupEnd: string;
  /** Group line (e.g., vertical bar) */
  groupLine: string;
  /** Done message */
  done: string;
  /** Failed message */
  failed: string;
};

/**
 * Unicode symbols for rich terminal output
 * Used when unicode support is detected
 */
export const UNICODE_SYMBOLS: SymbolSet = {
  success: '\u25C7', // ◇
  error: '\u25A0', // ■
  warning: '\u25B2', // ▲
  info: '\u25CF', // ●
  step: '\u25C7', // ◇
  groupStart: '\u250C', // ┌
  groupEnd: '\u2514', // └
  groupLine: '\u2502', // │
  done: '\u2714', // ✔
  failed: '\u2718', // ✘
};

/**
 * ASCII symbols for plain text output
 * Used in CI environments or when unicode is not supported
 */
export const ASCII_SYMBOLS: SymbolSet = {
  success: '[OK]',
  error: '[ERR]',
  warning: '[WARN]',
  info: '[INFO]',
  step: '-',
  groupStart: '[',
  groupEnd: ']',
  groupLine: '|',
  done: 'Done',
  failed: 'Failed',
};

/**
 * Get the appropriate symbol set based on output configuration
 *
 * @param config - Output configuration
 * @returns Symbol set to use
 */
export function getSymbols(config: OutputConfig): SymbolSet {
  return config.unicode ? UNICODE_SYMBOLS : ASCII_SYMBOLS;
}
