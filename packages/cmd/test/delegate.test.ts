/**
 * Unit tests for the launcher trampoline / delegation decision logic and the
 * core-capability check (src/delegate.ts). These are pure functions, so no
 * process spawning is required.
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import {
  findProjectRoot,
  shouldDelegate,
  coreSupportsTerminalDefaults,
} from '../src/delegate';

describe('findProjectRoot', () => {
  it('prefers the nearest dir with pok.config.ts', () => {
    const files = new Set([
      '/a/b/c/pok.config.ts',
      '/a/b/package.json',
      '/a/package.json',
    ]);
    const root = findProjectRoot('/a/b/c/d', (p) => files.has(p));
    expect(root).toBe('/a/b/c');
  });

  it('finds .config/pok.config.ts as an anchor', () => {
    const files = new Set(['/a/b/.config/pok.config.ts']);
    const root = findProjectRoot('/a/b/c', (p) => files.has(p));
    expect(root).toBe('/a/b');
  });

  it('falls back to the nearest package.json when no config exists', () => {
    const files = new Set(['/a/package.json']);
    const root = findProjectRoot('/a/b/c', (p) => files.has(p));
    expect(root).toBe('/a');
  });

  it('returns null when neither anchor is found', () => {
    const root = findProjectRoot('/a/b/c', () => false);
    expect(root).toBeNull();
  });
});

describe('shouldDelegate', () => {
  const current = '/global/node_modules/pokit/bin/pok.ts';

  it('delegates when a different local pokit is resolvable', () => {
    expect(
      shouldDelegate({
        delegated: false,
        localEntry: '/project/node_modules/pokit/bin/pok.ts',
        currentEntry: current,
      })
    ).toBe(true);
  });

  it('does not delegate when already delegated (recursion guard)', () => {
    expect(
      shouldDelegate({
        delegated: true,
        localEntry: '/project/node_modules/pokit/bin/pok.ts',
        currentEntry: current,
      })
    ).toBe(false);
  });

  it('does not delegate when there is no local pokit', () => {
    expect(
      shouldDelegate({ delegated: false, localEntry: null, currentEntry: current })
    ).toBe(false);
  });

  it('does not delegate when the local entry is the same installation', () => {
    // e.g. a workspace symlink where the global binary already IS the local one
    expect(
      shouldDelegate({ delegated: false, localEntry: current, currentEntry: current })
    ).toBe(false);
  });
});

describe('coreSupportsTerminalDefaults', () => {
  it('is true when core exports createMenuNavigator', () => {
    expect(coreSupportsTerminalDefaults({ createMenuNavigator: () => {} })).toBe(true);
  });

  it('is false for an old core without createMenuNavigator', () => {
    expect(coreSupportsTerminalDefaults({ runCli: () => {} })).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(coreSupportsTerminalDefaults(null)).toBe(false);
    expect(coreSupportsTerminalDefaults(undefined)).toBe(false);
  });
});
