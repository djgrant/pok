/**
 * Shared rendering vocabulary for prompt widgets.
 *
 * Prompts use the same visual language as the reporter frame: a dim left
 * rail, a state glyph on the message line, and dim hints. Kept separate from
 * the reporter theme because prompts only run interactively; ASCII/no-color
 * output modes never reach a prompt.
 */

import pc from 'picocolors';
import type { PromptState } from './prompt';

export const BAR = pc.dim('│'); // │
export const BAR_END = pc.dim('└'); // └

export const RADIO_ACTIVE = pc.green('●'); // ●
export const RADIO_INACTIVE = pc.dim('○'); // ○
export const CHECKBOX_SELECTED = pc.green('◼'); // ◼
export const CHECKBOX_UNSELECTED = pc.dim('◻'); // ◻

/** State glyph for the message line. */
export function stateSymbol(state: PromptState): string {
  switch (state) {
    case 'active':
      return pc.cyan('◆'); // ◆
    case 'error':
      return pc.yellow('▲'); // ▲
    case 'submit':
      return pc.green('◇'); // ◇
    case 'cancel':
      return pc.red('■'); // ■
  }
}

/** Message heading: preceding rail line + glyph + message. */
export function heading(state: PromptState, message: string): string[] {
  return [BAR, `${stateSymbol(state)}  ${message}`];
}

/** Closed frame for a submitted prompt: dim result under the message. */
export function submittedFrame(message: string, result: string): string {
  return [...heading('submit', message), `${BAR}  ${pc.dim(result)}`].join('\n');
}

/** Closed frame for a cancelled prompt. */
export function cancelledFrame(message: string): string {
  return [...heading('cancel', message), `${BAR}  ${pc.strikethrough(pc.dim('cancelled'))}`].join(
    '\n'
  );
}

export type Window = {
  start: number;
  end: number;
  moreAbove: boolean;
  moreBelow: boolean;
};

/**
 * Sliding window over a list so long option sets fit the screen, keeping the
 * cursor visible with ellipsis markers at clipped edges.
 */
export function windowItems(total: number, cursor: number, maxVisible: number): Window {
  if (total <= maxVisible) {
    return { start: 0, end: total, moreAbove: false, moreBelow: false };
  }
  let start = Math.max(0, Math.min(cursor - Math.floor(maxVisible / 2), total - maxVisible));
  const end = start + maxVisible;
  return { start, end, moreAbove: start > 0, moreBelow: end < total };
}

/** Default number of visible rows for a list, given terminal height. */
export function defaultMaxVisible(
  output: NodeJS.WritableStream,
  overhead: number,
  maxItems?: number
): number {
  const rows = (output as unknown as { rows?: number }).rows ?? 24;
  return Math.max(3, Math.min(maxItems ?? Infinity, rows - overhead));
}

export function dimHint(hint: string | undefined): string {
  return hint ? pc.dim(` (${hint})`) : '';
}
