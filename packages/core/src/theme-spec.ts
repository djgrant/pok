/**
 * Theme specification for the default terminal UI.
 *
 * A ThemeSpec is data, not behaviour: preset name, glyph strings, and colour
 * names. It lives in core so pok.config.ts can carry it without depending on
 * @pokit/terminal, and so alternative UI packages can honour the same spec.
 * The terminal package resolves a spec into its internal theme (closures over
 * a colour library) at startup.
 *
 * The spec themes the *default* terminal UI. A config that supplies its own
 * reporter/prompter instances owns its rendering; the spec does not apply.
 */

import type { StandardSchemaV1 } from './lib/schema';

/** Named colours a spec can assign to a slot. 'none' renders unstyled. */
export const THEME_COLORS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'dim',
  'none',
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number];

/** Glyph slots a spec can override. */
export type ThemeGlyphs = {
  info?: string;
  warn?: string;
  error?: string;
  success?: string;
  step?: string;
  /** Completed activity marker */
  activityDone?: string;
  /** Failed activity marker */
  activityFailed?: string;
};

/** Colour slots a spec can override. */
export type ThemeColors = {
  info?: ThemeColor;
  warn?: ThemeColor;
  error?: ThemeColor;
  success?: ThemeColor;
  step?: ThemeColor;
  /** Structural chrome: rails, box corners */
  frame?: ThemeColor;
  /** Live spinner glyph */
  spinner?: ThemeColor;
};

export type ThemeSpec = {
  /**
   * Built-in preset selecting the overall structure.
   * - 'rail': boxed output with a left rail (the default)
   * - 'minimal': flat, indentation-based output with no rails
   */
  preset?: 'rail' | 'minimal';
  /** Glyph overrides, applied over the preset. */
  glyphs?: ThemeGlyphs;
  /** Colour overrides, applied over the preset. */
  colors?: ThemeColors;
  /** Animation frames for the live spinner row. */
  spinnerFrames?: string[];
};

const PRESETS = ['rail', 'minimal'] as const;
const GLYPH_KEYS = [
  'info',
  'warn',
  'error',
  'success',
  'step',
  'activityDone',
  'activityFailed',
] as const;
const COLOR_KEYS = ['info', 'warn', 'error', 'success', 'step', 'frame', 'spinner'] as const;

type Issue = StandardSchemaV1.Issue;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkSlots(
  value: unknown,
  name: string,
  keys: readonly string[],
  check: (v: unknown) => string | undefined,
  issues: Issue[]
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push({ message: 'Expected object', path: [name] });
    return;
  }
  for (const key of keys) {
    const v = value[key];
    if (v === undefined) continue;
    const message = check(v);
    if (message) issues.push({ message, path: [name, key] });
  }
}

const checkGlyph = (v: unknown) =>
  typeof v === 'string' && v.length >= 1 && v.length <= 8
    ? undefined
    : 'Expected a string of 1 to 8 characters';

const checkColor = (v: unknown) =>
  (THEME_COLORS as readonly unknown[]).includes(v)
    ? undefined
    : `Expected one of: ${THEME_COLORS.join(', ')}`;

/** Collect validation issues for a theme spec. */
export function themeSpecIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [{ message: 'Expected object' }];
  const issues: Issue[] = [];
  if (value.preset !== undefined && !(PRESETS as readonly unknown[]).includes(value.preset)) {
    issues.push({ message: `Expected one of: ${PRESETS.join(', ')}`, path: ['preset'] });
  }
  checkSlots(value.glyphs, 'glyphs', GLYPH_KEYS, checkGlyph, issues);
  checkSlots(value.colors, 'colors', COLOR_KEYS, checkColor, issues);
  const frames = value.spinnerFrames;
  if (frames !== undefined) {
    if (
      !Array.isArray(frames) ||
      frames.length < 2 ||
      !frames.every((f) => typeof f === 'string' && f.length > 0)
    ) {
      issues.push({
        message: 'Expected an array of at least 2 non-empty strings',
        path: ['spinnerFrames'],
      });
    }
  }
  return issues;
}
