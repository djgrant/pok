import { describe, it, expect } from 'bun:test';
import { createTerminalUI } from '../src';

describe('createTerminalUI', () => {
  it('returns reporter, prompter, and navigator surfaces', () => {
    const ui = createTerminalUI({ output: { color: false, unicode: false, verbose: false, interactive: false } });

    expect(typeof ui.reporter.start).toBe('function');
    expect(typeof ui.prompter.select).toBe('function');
    expect(typeof ui.prompter.multiselect).toBe('function');
    expect(typeof ui.prompter.confirm).toBe('function');
    expect(typeof ui.prompter.text).toBe('function');
    expect(typeof ui.prompter.autocomplete).toBe('function');
    expect(typeof ui.navigator.choose).toBe('function');
  });

  it('creates independent instances', () => {
    const a = createTerminalUI();
    const b = createTerminalUI();
    expect(a.prompter).not.toBe(b.prompter);
    expect(a.navigator).not.toBe(b.navigator);
  });
});
