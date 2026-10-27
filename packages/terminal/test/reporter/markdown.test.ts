import { describe, it, expect } from 'bun:test';
import { renderTerminalMarkdown } from '../../src/reporter/renderer/markdown';

const plain = (md: string, width = 60, unicode = true) =>
  renderTerminalMarkdown(md, { width, unicode }).replace(/\u001b\[[0-9;]*m/g, '');

describe('renderTerminalMarkdown', () => {
  it('keeps heading markers and reflows paragraphs', () => {
    expect(plain('# Title\n\nline one\nline two')).toBe('# Title\n\nline one line two\n\n');
  });

  it('does not HTML-escape text or code', () => {
    expect(plain('a & b "c" it\'s `x < y`')).toBe('a & b "c" it\'s x < y\n\n');
  });

  it('shows link targets', () => {
    expect(plain('[docs](https://x.dev) and https://y.dev')).toBe(
      'docs (https://x.dev) and https://y.dev\n\n'
    );
  });

  it('indents code blocks and quotes', () => {
    expect(plain('```\na\nb\n```\n\n> quoted')).toBe('    a\n    b\n\n    quoted\n\n');
  });

  it('boxes tables', () => {
    expect(plain('| a | b |\n|---|---|\n| 1 | 22 |', 60, false)).toBe(
      '+---+----+\n| a | b  |\n+---+----+\n| 1 | 22 |\n+---+----+\n\n'
    );
  });

  it('wraps nested list items under their marker', () => {
    const out = plain('- one two three four five six\n  1. seven eight nine ten', 20);
    expect(out.split('\n').filter(Boolean)).toEqual([
      '  • one two three',
      '    four five six',
      '      1. seven eight',
      '         nine ten',
    ]);
    expect(Math.max(...out.split('\n').map((l) => l.length))).toBeLessThanOrEqual(20);
  });
});
