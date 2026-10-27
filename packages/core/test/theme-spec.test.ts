import { describe, it, expect } from 'bun:test';
import { themeSpecIssues } from '../src/theme-spec';
import { validateConfig } from '../src/config';

describe('themeSpecIssues', () => {
  it('accepts a full valid spec', () => {
    expect(
      themeSpecIssues({
        preset: 'minimal',
        glyphs: { activityDone: '✓' },
        colors: { success: 'cyan', frame: 'gray' },
        spinnerFrames: ['-', '+'],
      })
    ).toEqual([]);
  });

  it('rejects unknown presets and colours', () => {
    expect(themeSpecIssues({ preset: 'neon' })[0]?.path).toEqual(['preset']);
    expect(themeSpecIssues({ colors: { success: 'sparkly' } })[0]?.path).toEqual([
      'colors',
      'success',
    ]);
  });

  it('rejects bad glyphs and spinner frames', () => {
    expect(themeSpecIssues({ glyphs: { info: '' } })).toHaveLength(1);
    expect(themeSpecIssues({ spinnerFrames: ['x'] })).toHaveLength(1);
  });
});

describe('validateConfig', () => {
  it('applies defaults to a valid config', () => {
    const cfg = validateConfig({ appName: 'x', pmScripts: ['test:*'] }, 'pok.config.ts');
    expect(cfg.appDir).toBe('.');
    expect(cfg.cwd).toBe('.');
    expect(cfg.appName).toBe('x');
  });

  it('reports every invalid field with its path', () => {
    expect(() =>
      validateConfig({ appName: 1, pmCommands: 'yes', theme: { preset: 'neon' } }, 'pok.config.ts')
    ).toThrow(
      'Invalid configuration in pok.config.ts:\n  - appName: Expected string\n  - pmCommands: Expected boolean or string[]\n  - theme.preset: Expected one of: rail, minimal'
    );
  });
});
