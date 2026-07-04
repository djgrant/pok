import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { formatTable, formatCsv } from '../src/lib/tabular';

describe('formatTable', () => {
  it('renders an array of flat objects as an aligned table', () => {
    const data = [
      { id: 'T-1', title: 'Build output system', status: 'in-progress' },
      { id: 'T-2', title: 'Write tests', status: 'todo' },
    ];
    const out = formatTable(data)!;
    const lines = out.split('\n');
    expect(lines[0]).toBe('id   title                status');
    expect(lines[1]).toBe('---  -------------------  -----------');
    expect(lines[2]).toBe('T-1  Build output system  in-progress');
    expect(lines[3]).toBe('T-2  Write tests          todo');
  });

  it('prefers schema key order for columns', () => {
    const schema = z.array(z.object({ id: z.string(), title: z.string() }));
    // Row keys are in a different order than the schema.
    const data = [{ title: 'A', id: '1' }];
    const out = formatTable(data, schema)!;
    expect(out.split('\n')[0]).toBe('id  title');
  });

  it('renders a single object as a key/value table', () => {
    const out = formatTable({ name: 'pok', count: 3 })!;
    const lines = out.split('\n');
    expect(lines[0]).toBe('key    value');
    expect(lines[2]).toBe('name   pok');
    expect(lines[3]).toBe('count  3');
  });

  it('JSON-stringifies nested cell values', () => {
    const out = formatTable([{ id: '1', tags: ['a', 'b'] }])!;
    expect(out).toContain('["a","b"]');
  });

  it('returns empty string for an empty array without schema', () => {
    expect(formatTable([])).toBe('');
  });

  it('emits a header-only table for an empty array with a schema', () => {
    const schema = z.array(z.object({ id: z.string(), title: z.string() }));
    const out = formatTable([], schema)!;
    expect(out.split('\n')).toEqual(['id  title', '--  -----']);
  });

  it('returns null (non-tabular) for a scalar', () => {
    expect(formatTable(42)).toBeNull();
    expect(formatTable('hello')).toBeNull();
  });

  it('returns null for an array of scalars', () => {
    expect(formatTable([1, 2, 3])).toBeNull();
  });
});

describe('formatCsv', () => {
  it('renders an array of objects as CSV with a header row', () => {
    const data = [
      { id: 'T-1', title: 'a' },
      { id: 'T-2', title: 'b' },
    ];
    expect(formatCsv(data)).toBe('id,title\nT-1,a\nT-2,b');
  });

  it('quotes and escapes fields with commas, quotes and newlines', () => {
    const data = [
      { a: 'has,comma', b: 'has"quote', c: 'has\nnewline' },
    ];
    const out = formatCsv(data)!;
    expect(out.split('\n')[0]).toBe('a,b,c');
    expect(out).toContain('"has,comma"');
    expect(out).toContain('"has""quote"');
    expect(out).toContain('"has\nnewline"');
  });

  it('renders a single object as header + one row', () => {
    expect(formatCsv({ name: 'pok', count: 3 })).toBe('name,count\npok,3');
  });

  it('returns empty string for an empty array without schema', () => {
    expect(formatCsv([])).toBe('');
  });

  it('emits header only for an empty array with a schema', () => {
    const schema = z.array(z.object({ id: z.string(), title: z.string() }));
    expect(formatCsv([], schema)).toBe('id,title');
  });

  it('returns null (non-tabular) for a scalar', () => {
    expect(formatCsv(true)).toBeNull();
  });
});
