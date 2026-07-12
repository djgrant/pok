/**
 * Theme: symbols and colour as data.
 *
 * The frame decides *what* to draw (box open, line, block); the theme decides
 * what the glyphs look like. Unicode vs ASCII and colour vs no-colour are
 * theme swaps, so no rendering code branches on output mode.
 */

import pc from 'picocolors';
import type { OutputConfig } from '@pokit/core';

/** Semantic kinds of line the frame can draw. */
export type LineKind =
  | 'info'
  | 'warn'
  | 'error'
  | 'success'
  | 'step'
  | 'activityDone'
  | 'activityFailed';

export type Theme = {
  /** Lone rail line drawn between elements inside a box; null to skip. */
  spacer: string | null;
  /** Box opening line. */
  open(label: string): string;
  /** Box closing line. */
  close(status: 'done' | 'failed'): string;
  /** First line of an in-box element. */
  line(kind: LineKind, text: string): string;
  /** Continuation line of a multi-line in-box element. */
  continuation(text: string): string;
  /** First line of a standalone block outside any box. */
  block(kind: LineKind, text: string): string;
  /** Continuation line of a standalone block. */
  blockContinuation(text: string): string;
  /** Animation frames for the live spinner row. */
  spinnerFrames: string[];
  /** Prefix a live (in-flight) row. */
  liveLine(frame: string, text: string): string;
};

type Glyphs = Record<LineKind, { glyph: string; color: (s: string) => string }>;

export function createTheme(config: OutputConfig): Theme {
  const useColor = config.color;
  const c = (fn: (s: string) => string) => (useColor ? fn : (s: string) => s);
  const dim = c(pc.dim);
  const bold = c(pc.bold);

  if (config.unicode) {
    const glyphs: Glyphs = {
      info: { glyph: '●', color: c(pc.cyan) }, // ●
      warn: { glyph: '▲', color: c(pc.yellow) }, // ▲
      error: { glyph: '■', color: c(pc.red) }, // ■
      success: { glyph: '✔', color: c(pc.green) }, // ✔
      step: { glyph: '▸', color: c(pc.cyan) }, // ▸
      activityDone: { glyph: '◇', color: c(pc.green) }, // ◇
      activityFailed: { glyph: '■', color: c(pc.red) }, // ■
    };
    return {
      spacer: dim('│'), // │
      open: (label) => `${dim('┌')}  ${bold(label)}`, // ┌
      close: (status) =>
        `${dim('└')}  ${
          status === 'done' ? c(pc.green)('✔ Done') : c(pc.red)('✘ Failed')
        }`, // └ ✔ / ✘
      line: (kind, text) => `${glyphs[kind].color(glyphs[kind].glyph)}  ${text}`,
      continuation: (text) => `${dim('│')}  ${text}`.trimEnd(),
      block: (kind, text) => `${glyphs[kind].color(glyphs[kind].glyph)}  ${text}`,
      blockContinuation: (text) => `   ${text}`.trimEnd(),
      spinnerFrames: ['◒', '◐', '◓', '◑'], // ◒◐◓◑
      liveLine: (frame, text) => `${c(pc.magenta)(frame)}  ${text}`,
    };
  }

  const tags: Glyphs = {
    info: { glyph: '[INFO]', color: c(pc.cyan) },
    warn: { glyph: '[WARN]', color: c(pc.yellow) },
    error: { glyph: '[ERR]', color: c(pc.red) },
    success: { glyph: '[OK]', color: c(pc.green) },
    step: { glyph: '-', color: c(pc.cyan) },
    activityDone: { glyph: '[OK]', color: c(pc.green) },
    activityFailed: { glyph: '[ERR]', color: c(pc.red) },
  };
  return {
    spacer: null,
    open: (label) => `[${bold(label)}]`,
    close: (status) =>
      status === 'done' ? `[${c(pc.green)('Done')}]` : `[${c(pc.red)('Failed')}]`,
    line: (kind, text) => `  ${tags[kind].color(tags[kind].glyph)} ${text}`,
    continuation: (text) => `    ${text}`.trimEnd(),
    block: (kind, text) => `${tags[kind].color(tags[kind].glyph)} ${text}`,
    blockContinuation: (text) => `  ${text}`.trimEnd(),
    spinnerFrames: ['-', '\\', '|', '/'],
    liveLine: (frame, text) => `  ${frame} ${text}`,
  };
}
