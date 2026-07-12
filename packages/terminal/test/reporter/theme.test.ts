/**
 * ThemeSpec resolution tests: presets, glyph overrides, and spec validation.
 */

import { describe, it, expect } from 'bun:test';
import { ThemeSpecSchema } from '@pokit/core';
import { createTheme } from '../../src/reporter/renderer/theme';
import { createPromptTheme } from '../../src/prompter/engine/render';

const output = { color: false, unicode: true, verbose: false, interactive: true };

describe('createTheme', () => {
  it('defaults to the rail preset', () => {
    const theme = createTheme(output);
    expect(theme.open('Build')).toBe('┌  Build');
    expect(theme.spacer).toBe('│');
  });

  it('selects the minimal preset', () => {
    const theme = createTheme(output, { preset: 'minimal' });
    expect(theme.open('Build')).toBe('▶ Build');
    expect(theme.spacer).toBeNull();
    expect(theme.close('done')).toBe('✓ done');
  });

  it('applies glyph overrides over a preset', () => {
    const theme = createTheme(output, { glyphs: { activityDone: '✓', step: '»' } });
    expect(theme.line('activityDone', 'Compile')).toBe('✓  Compile');
    expect(theme.line('step', 'Next')).toBe('»  Next');
    // Untouched slots keep the preset glyph
    expect(theme.line('warn', 'Careful')).toBe('▲  Careful');
  });

  it('applies custom spinner frames', () => {
    const theme = createTheme(output, { spinnerFrames: ['.', 'o', 'O'] });
    expect(theme.spinnerFrames).toEqual(['.', 'o', 'O']);
  });
});

describe('createPromptTheme', () => {
  it('rail preset draws the rail vocabulary', () => {
    const t = createPromptTheme();
    expect(t.item('x')).toContain('│');
    expect(t.end().length).toBe(1);
  });

  it('minimal preset is flat', () => {
    const t = createPromptTheme({ preset: 'minimal' });
    expect(t.item('x')).toBe('  x');
    expect(t.end()).toEqual([]);
    expect(t.heading('active', 'Pick')[0]).toContain('?');
  });
});

describe('ThemeSpecSchema', () => {
  it('accepts a full valid spec', () => {
    const result = ThemeSpecSchema.safeParse({
      preset: 'minimal',
      glyphs: { activityDone: '✓' },
      colors: { success: 'cyan', frame: 'gray' },
      spinnerFrames: ['-', '+'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown presets and colours', () => {
    expect(ThemeSpecSchema.safeParse({ preset: 'neon' }).success).toBe(false);
    expect(ThemeSpecSchema.safeParse({ colors: { success: 'sparkly' } }).success).toBe(false);
  });
});
