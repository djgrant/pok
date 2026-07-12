/**
 * Theme: symbols and colour as data.
 *
 * The frame decides *what* to draw (box open, line, block); the theme decides
 * what the glyphs look like. Unicode vs ASCII and colour vs no-colour are
 * theme swaps, so no rendering code branches on output mode.
 *
 * Two structural presets are built in:
 * - 'rail': boxed output with a left rail (┌ │ └), the default
 * - 'minimal': flat, indentation-based output with no rails
 *
 * A ThemeSpec from pok.config.ts selects a preset and overrides glyphs,
 * colours, and spinner frames on top of it.
 */

import pc from 'picocolors';
import type { OutputConfig, ThemeSpec, ThemeColor } from '@pokit/core';

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

type ColorFn = (s: string) => string;

export type Palette = {
  info: ColorFn;
  warn: ColorFn;
  error: ColorFn;
  success: ColorFn;
  step: ColorFn;
  frame: ColorFn;
  spinner: ColorFn;
  dim: ColorFn;
  bold: ColorFn;
};

type GlyphSet = Record<LineKind, string>;

const identity: ColorFn = (s) => s;

const NAMED_COLORS: Record<ThemeColor, ColorFn> = {
  black: pc.black,
  red: pc.red,
  green: pc.green,
  yellow: pc.yellow,
  blue: pc.blue,
  magenta: pc.magenta,
  cyan: pc.cyan,
  white: pc.white,
  gray: pc.gray,
  dim: pc.dim,
  none: identity,
};

function resolveColor(name: ThemeColor | undefined, fallback: ColorFn, useColor: boolean): ColorFn {
  if (!useColor) return identity;
  return name ? NAMED_COLORS[name] : fallback;
}

/** Resolve the palette: preset defaults, spec overrides, no-color stripping. */
export function resolvePalette(config: OutputConfig, spec?: ThemeSpec): Palette {
  const useColor = config.color;
  const colors = spec?.colors ?? {};
  return {
    info: resolveColor(colors.info, pc.cyan, useColor),
    warn: resolveColor(colors.warn, pc.yellow, useColor),
    error: resolveColor(colors.error, pc.red, useColor),
    success: resolveColor(colors.success, pc.green, useColor),
    step: resolveColor(colors.step, pc.cyan, useColor),
    frame: resolveColor(colors.frame, pc.dim, useColor),
    spinner: resolveColor(colors.spinner, pc.magenta, useColor),
    dim: useColor ? pc.dim : identity,
    bold: useColor ? pc.bold : identity,
  };
}

function kindColor(palette: Palette, kind: LineKind): ColorFn {
  switch (kind) {
    case 'activityDone':
      return palette.success;
    case 'activityFailed':
      return palette.error;
    default:
      return palette[kind];
  }
}

function resolveGlyphs(defaults: GlyphSet, spec?: ThemeSpec): GlyphSet {
  return { ...defaults, ...(spec?.glyphs ?? {}) };
}

// =============================================================================
// Preset: rail (boxed output with a left rail)
// =============================================================================

const RAIL_GLYPHS_UNICODE: GlyphSet = {
  info: '●', // ●
  warn: '▲', // ▲
  error: '■', // ■
  success: '✔', // ✔
  step: '▸', // ▸
  activityDone: '◇', // ◇
  activityFailed: '■', // ■
};

const RAIL_GLYPHS_ASCII: GlyphSet = {
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERR]',
  success: '[OK]',
  step: '-',
  activityDone: '[OK]',
  activityFailed: '[ERR]',
};

function railTheme(config: OutputConfig, palette: Palette, spec?: ThemeSpec): Theme {
  const p_ = palette;
  const spinnerFrames = spec?.spinnerFrames ?? (config.unicode ? ['◒', '◐', '◓', '◑'] : ['-', '\\', '|', '/']);

  if (config.unicode) {
    const glyphs = resolveGlyphs(RAIL_GLYPHS_UNICODE, spec);
    return {
      spacer: p_.frame('│'), // │
      open: (label) => `${p_.frame('┌')}  ${p_.bold(label)}`, // ┌
      close: (status) =>
        `${p_.frame('└')}  ${
          status === 'done' ? p_.success('✔ Done') : p_.error('✘ Failed')
        }`, // └ ✔ / ✘
      line: (kind, text) => `${kindColor(p_, kind)(glyphs[kind])}  ${text}`,
      continuation: (text) => `${p_.frame('│')}  ${text}`.trimEnd(),
      block: (kind, text) => `${kindColor(p_, kind)(glyphs[kind])}  ${text}`,
      blockContinuation: (text) => `   ${text}`.trimEnd(),
      spinnerFrames,
      liveLine: (frame, text) => `${p_.spinner(frame)}  ${text}`,
    };
  }

  const glyphs = resolveGlyphs(RAIL_GLYPHS_ASCII, spec);
  return {
    spacer: null,
    open: (label) => `[${p_.bold(label)}]`,
    close: (status) => (status === 'done' ? `[${p_.success('Done')}]` : `[${p_.error('Failed')}]`),
    line: (kind, text) => `  ${kindColor(p_, kind)(glyphs[kind])} ${text}`,
    continuation: (text) => `    ${text}`.trimEnd(),
    block: (kind, text) => `${kindColor(p_, kind)(glyphs[kind])} ${text}`,
    blockContinuation: (text) => `  ${text}`.trimEnd(),
    spinnerFrames,
    liveLine: (frame, text) => `  ${frame} ${text}`,
  };
}

// =============================================================================
// Preset: minimal (flat, indentation-based, no rails)
// =============================================================================

const MINIMAL_GLYPHS_UNICODE: GlyphSet = {
  info: '·', // ·
  warn: '!',
  error: '✗', // ✗
  success: '✓', // ✓
  step: '›', // ›
  activityDone: '✓', // ✓
  activityFailed: '✗', // ✗
};

const MINIMAL_GLYPHS_ASCII: GlyphSet = {
  info: '.',
  warn: '!',
  error: 'x',
  success: '+',
  step: '>',
  activityDone: '+',
  activityFailed: 'x',
};

function minimalTheme(config: OutputConfig, palette: Palette, spec?: ThemeSpec): Theme {
  const p_ = palette;
  const glyphs = resolveGlyphs(config.unicode ? MINIMAL_GLYPHS_UNICODE : MINIMAL_GLYPHS_ASCII, spec);
  const spinnerFrames =
    spec?.spinnerFrames ??
    (config.unicode ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] : ['-', '\\', '|', '/']);
  const openGlyph = config.unicode ? '▶' : '>'; // ▶
  const doneWord = config.unicode ? '✓ done' : '+ done';
  const failedWord = config.unicode ? '✗ failed' : 'x failed';

  return {
    spacer: null,
    open: (label) => `${p_.frame(openGlyph)} ${p_.bold(label)}`,
    close: (status) => (status === 'done' ? p_.success(doneWord) : p_.error(failedWord)),
    line: (kind, text) => `  ${kindColor(p_, kind)(glyphs[kind])} ${text}`,
    continuation: (text) => `    ${text}`.trimEnd(),
    block: (kind, text) => `${kindColor(p_, kind)(glyphs[kind])} ${text}`,
    blockContinuation: (text) => `  ${text}`.trimEnd(),
    spinnerFrames,
    liveLine: (frame, text) => `  ${p_.spinner(frame)} ${text}`,
  };
}

// =============================================================================
// Factory
// =============================================================================

export function createTheme(config: OutputConfig, spec?: ThemeSpec): Theme {
  const palette = resolvePalette(config, spec);
  const preset = spec?.preset ?? 'rail';
  return preset === 'minimal'
    ? minimalTheme(config, palette, spec)
    : railTheme(config, palette, spec);
}
