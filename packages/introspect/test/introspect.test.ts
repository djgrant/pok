import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createInitialState,
  moveSelection,
  toggleDirectory,
  scrollPreview,
  getSelectedEntry,
  getSelectedFilePath,
} from '../src/state';
import { scanDirectory, refreshTree, readFileContent } from '../src/tree';
import { highlightCode } from '../src/highlight';

// Test fixtures
const TEST_DIR = '/tmp/introspect-test-' + Date.now();

beforeAll(() => {
  fs.mkdirSync(path.join(TEST_DIR, 'subdir'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'hello.ts'), 'export const x = 1;');
  fs.writeFileSync(path.join(TEST_DIR, 'test.js'), 'console.log("test");');
  fs.writeFileSync(path.join(TEST_DIR, 'subdir', 'nested.ts'), 'export const y = 2;');
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('state', () => {
  it('creates initial state', () => {
    const state = createInitialState('/some/path');
    expect(state.rootDir).toBe('/some/path');
    expect(state.entries).toEqual([]);
    expect(state.selectedIndex).toBe(0);
    expect(state.previewScroll).toBe(0);
  });

  it('moves selection up and down', () => {
    const state = createInitialState('/path');
    state.entries = [
      { path: '/path/a', name: 'a', type: 'file', depth: 0 },
      { path: '/path/b', name: 'b', type: 'file', depth: 0 },
      { path: '/path/c', name: 'c', type: 'file', depth: 0 },
    ];

    expect(state.selectedIndex).toBe(0);

    moveSelection(state, 1);
    expect(state.selectedIndex).toBe(1);

    moveSelection(state, 1);
    expect(state.selectedIndex).toBe(2);

    // Can't go past end
    moveSelection(state, 1);
    expect(state.selectedIndex).toBe(2);

    moveSelection(state, -1);
    expect(state.selectedIndex).toBe(1);

    moveSelection(state, -2);
    expect(state.selectedIndex).toBe(1); // Would go negative, stays at 1
  });

  it('toggles directory expansion', () => {
    const state = createInitialState('/path');
    state.entries = [{ path: '/path/dir', name: 'dir', type: 'directory', depth: 0 }];

    expect(state.expandedDirs.has('/path/dir')).toBe(false);

    toggleDirectory(state);
    expect(state.expandedDirs.has('/path/dir')).toBe(true);

    toggleDirectory(state);
    expect(state.expandedDirs.has('/path/dir')).toBe(false);
  });

  it('scrolls preview', () => {
    const state = createInitialState('/path');
    expect(state.previewScroll).toBe(0);

    scrollPreview(state, 10);
    expect(state.previewScroll).toBe(10);

    scrollPreview(state, -5);
    expect(state.previewScroll).toBe(5);

    // Can't go negative
    scrollPreview(state, -10);
    expect(state.previewScroll).toBe(5);
  });

  it('gets selected entry and file path', () => {
    const state = createInitialState('/path');
    state.entries = [
      { path: '/path/dir', name: 'dir', type: 'directory', depth: 0 },
      { path: '/path/file.ts', name: 'file.ts', type: 'file', depth: 0 },
    ];

    state.selectedIndex = 0;
    expect(getSelectedEntry(state)?.name).toBe('dir');
    expect(getSelectedFilePath(state)).toBeNull(); // Directory

    state.selectedIndex = 1;
    expect(getSelectedEntry(state)?.name).toBe('file.ts');
    expect(getSelectedFilePath(state)).toBe('/path/file.ts');
  });
});

describe('tree', () => {
  it('scans directory and returns entries', () => {
    const entries = scanDirectory(TEST_DIR, new Set());

    expect(entries.length).toBe(3); // subdir, hello.ts, test.js
    expect(entries.some((e) => e.name === 'subdir' && e.type === 'directory')).toBe(true);
    expect(entries.some((e) => e.name === 'hello.ts' && e.type === 'file')).toBe(true);
    expect(entries.some((e) => e.name === 'test.js' && e.type === 'file')).toBe(true);
  });

  it('expands directories when in expandedDirs set', () => {
    const expandedDirs = new Set([path.join(TEST_DIR, 'subdir')]);
    const entries = scanDirectory(TEST_DIR, expandedDirs);

    expect(entries.length).toBe(4); // subdir, nested.ts, hello.ts, test.js
    expect(entries.some((e) => e.name === 'nested.ts')).toBe(true);
  });

  it('refreshes tree and preserves selection', () => {
    const state = createInitialState(TEST_DIR);
    refreshTree(state);

    expect(state.entries.length).toBe(3);

    // Select second item
    state.selectedIndex = 1;
    const selectedPath = state.entries[1].path;

    refreshTree(state);

    // Selection preserved
    expect(state.entries[state.selectedIndex].path).toBe(selectedPath);
  });

  it('reads file content', () => {
    const content = readFileContent(path.join(TEST_DIR, 'hello.ts'));
    expect(content).toBe('export const x = 1;');
  });

  it('handles missing files gracefully', () => {
    const content = readFileContent('/nonexistent/file.ts');
    expect(content).toBe('(Unable to read file)');
  });
});

describe('highlight', () => {
  it('processes TypeScript code without error', () => {
    const code = 'const x: number = 1;';
    const highlighted = highlightCode(code, 'test.ts');

    // Should return a string (may or may not have ANSI codes depending on TTY)
    expect(typeof highlighted).toBe('string');
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it('returns unhighlighted for unknown extensions', () => {
    const code = 'some random text';
    const highlighted = highlightCode(code, 'test.xyz');

    // Should be unchanged
    expect(highlighted).toBe(code);
  });

  it('handles various file extensions without error', () => {
    const code = 'var x = 1;';

    // Should process without throwing
    expect(typeof highlightCode(code, 'test.js')).toBe('string');
    expect(typeof highlightCode(code, 'test.mjs')).toBe('string');
    expect(typeof highlightCode(code, 'test.cjs')).toBe('string');
    expect(typeof highlightCode(code, 'test.json')).toBe('string');
  });
});
