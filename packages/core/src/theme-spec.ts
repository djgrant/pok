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

import { z } from 'zod';

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

const glyphSchema = z.string().min(1).max(8);
const colorSchema = z.enum(THEME_COLORS);

export const ThemeSpecSchema = z.object({
  preset: z.enum(['rail', 'minimal']).optional(),
  glyphs: z
    .object({
      info: glyphSchema.optional(),
      warn: glyphSchema.optional(),
      error: glyphSchema.optional(),
      success: glyphSchema.optional(),
      step: glyphSchema.optional(),
      activityDone: glyphSchema.optional(),
      activityFailed: glyphSchema.optional(),
    })
    .optional(),
  colors: z
    .object({
      info: colorSchema.optional(),
      warn: colorSchema.optional(),
      error: colorSchema.optional(),
      success: colorSchema.optional(),
      step: colorSchema.optional(),
      frame: colorSchema.optional(),
      spinner: colorSchema.optional(),
    })
    .optional(),
  spinnerFrames: z.array(z.string().min(1)).min(2).optional(),
});
