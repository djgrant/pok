/**
 * Prompt theming.
 *
 * Prompts share the reporter's presets: the 'rail' theme draws the same dim
 * left rail and state glyphs as the boxed reporter output; the 'minimal'
 * theme is flat and indentation-based. A PromptTheme is injected into each
 * widget so the whole UI follows one ThemeSpec. Prompts only run on styled
 * interactive terminals, so colour is always on and glyphs are unicode.
 */

import pc from 'picocolors';
import type { ThemeSpec } from '@pokit/core';
import { resolvePalette, type Palette } from '../../reporter/renderer/theme';
import type { PromptState } from './prompt';

export type PromptTheme = {
  /** Message heading lines for the current state. */
  heading(state: PromptState, message: string): string[];
  /** A body line (option, input, hint) inside the prompt. */
  item(content: string): string;
  /** Closing lines under the body. */
  end(): string[];
  /** Closed frame for a submitted prompt. */
  submitted(message: string, result: string): string;
  /** Closed frame for a cancelled prompt. */
  cancelled(message: string): string;
  /** Radio marker for a (non-)focused option. */
  radio(active: boolean): string;
  /** Checkbox marker for a (de)selected option. */
  checkbox(selected: boolean): string;
  /** Validation / warning line. */
  problem(message: string): string;
  /** Clipped-list ellipsis row. */
  ellipsis(): string;
  palette: Palette;
};

function railPromptTheme(palette: Palette, glyphs: ThemeSpec['glyphs']): PromptTheme {
  const bar = palette.frame('│'); // │
  const stateGlyph = (state: PromptState): string => {
    switch (state) {
      case 'active':
        return palette.info('◆'); // ◆
      case 'error':
        return palette.warn(glyphs?.warn ?? '▲'); // ▲
      case 'submit':
        return palette.success(glyphs?.activityDone ?? '◇'); // ◇
      case 'cancel':
        return palette.error(glyphs?.error ?? '■'); // ■
    }
  };
  const item = (content: string) => `${bar}  ${content}`;
  return {
    heading: (state, message) => [bar, `${stateGlyph(state)}  ${message}`],
    item,
    end: () => [palette.frame('└')], // └
    submitted: (message, result) =>
      [bar, `${stateGlyph('submit')}  ${message}`, item(palette.dim(result))].join('\n'),
    cancelled: (message) =>
      [bar, `${stateGlyph('cancel')}  ${message}`, item(pc.strikethrough(palette.dim('cancelled')))].join('\n'),
    radio: (active) => (active ? palette.success('●') : palette.dim('○')), // ● ○
    checkbox: (selected) => (selected ? palette.success('◼') : palette.dim('◻')), // ◼ ◻
    problem: (message) => item(palette.warn(message)),
    ellipsis: () => item(palette.dim('…')),
    palette,
  };
}

function minimalPromptTheme(palette: Palette, glyphs: ThemeSpec['glyphs']): PromptTheme {
  const stateGlyph = (state: PromptState): string => {
    switch (state) {
      case 'active':
        return palette.info('?');
      case 'error':
        return palette.warn(glyphs?.warn ?? '!');
      case 'submit':
        return palette.success(glyphs?.activityDone ?? '✓'); // ✓
      case 'cancel':
        return palette.error(glyphs?.error ?? '✗'); // ✗
    }
  };
  const item = (content: string) => `  ${content}`;
  return {
    heading: (state, message) => [`${stateGlyph(state)} ${palette.bold(message)}`],
    item,
    end: () => [],
    submitted: (message, result) =>
      `${stateGlyph('submit')} ${palette.bold(message)} ${palette.dim(result)}`,
    cancelled: (message) =>
      `${stateGlyph('cancel')} ${palette.bold(message)} ${palette.dim('cancelled')}`,
    radio: (active) => (active ? palette.info('❯') : ' '), // ❯
    checkbox: (selected) => (selected ? palette.success('[x]') : palette.dim('[ ]')),
    problem: (message) => item(palette.warn(message)),
    ellipsis: () => item(palette.dim('…')),
    palette,
  };
}

/**
 * Build the prompt theme for a spec. Prompts always render with colour and
 * unicode; output-mode stripping never applies because prompts require an
 * interactive styled terminal.
 */
export function createPromptTheme(spec?: ThemeSpec): PromptTheme {
  const palette = resolvePalette(
    { color: true, unicode: true, verbose: false, interactive: true },
    spec
  );
  return (spec?.preset ?? 'rail') === 'minimal'
    ? minimalPromptTheme(palette, spec?.glyphs)
    : railPromptTheme(palette, spec?.glyphs);
}

export const defaultPromptTheme: PromptTheme = createPromptTheme();

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
  const start = Math.max(0, Math.min(cursor - Math.floor(maxVisible / 2), total - maxVisible));
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
