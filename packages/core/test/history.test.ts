import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadHistory, appendHistory, clearHistory, formatEntryLabel } from '../src/lib/history';

const TEST_APP = `pok-history-test-${process.pid}`;

function getHistoryPath() {
  const dataDir =
    process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.local', 'share');
  return path.join(dataDir, 'pok', TEST_APP, 'history.json');
}

beforeEach(() => {
  clearHistory(TEST_APP);
});

afterEach(() => {
  clearHistory(TEST_APP);
  const historyPath = getHistoryPath();
  const dir = path.dirname(historyPath);
  try {
    fs.rmdirSync(dir);
  } catch {}
});

// =============================================================================
// loadHistory
// =============================================================================

describe('loadHistory', () => {
  it('returns empty array when no history exists', () => {
    expect(loadHistory(TEST_APP)).toEqual([]);
  });

  it('returns entries after appending', () => {
    appendHistory(TEST_APP, ['deploy'], ['--env', 'prod']);
    const entries = loadHistory(TEST_APP);
    expect(entries).toHaveLength(1);
    expect(entries[0].commandPath).toEqual(['deploy']);
    expect(entries[0].args).toEqual(['--env', 'prod']);
  });

  it('returns entries in most-recent-first order', () => {
    appendHistory(TEST_APP, ['db', 'migrate'], []);
    appendHistory(TEST_APP, ['deploy'], ['--env', 'prod']);
    const entries = loadHistory(TEST_APP);
    expect(entries).toHaveLength(2);
    expect(entries[0].commandPath).toEqual(['deploy']);
    expect(entries[1].commandPath).toEqual(['db', 'migrate']);
  });

  it('returns empty array for corrupted history file', () => {
    const historyPath = getHistoryPath();
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, 'not valid json', 'utf-8');
    expect(loadHistory(TEST_APP)).toEqual([]);
  });

  it('returns empty array for malformed JSON without entries key', () => {
    const historyPath = getHistoryPath();
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, '{"foo": "bar"}', 'utf-8');
    expect(loadHistory(TEST_APP)).toEqual([]);
  });
});

// =============================================================================
// appendHistory
// =============================================================================

describe('appendHistory', () => {
  it('creates history file if it does not exist', () => {
    appendHistory(TEST_APP, ['dev'], []);
    const historyPath = getHistoryPath();
    expect(fs.existsSync(historyPath)).toBe(true);
  });

  it('stores commandPath and args correctly', () => {
    appendHistory(TEST_APP, ['db', 'seed'], ['--env', 'dev']);
    const entries = loadHistory(TEST_APP);
    expect(entries[0].commandPath).toEqual(['db', 'seed']);
    expect(entries[0].args).toEqual(['--env', 'dev']);
  });

  it('stores a timestamp on each entry', () => {
    const before = new Date().toISOString();
    appendHistory(TEST_APP, ['dev'], []);
    const after = new Date().toISOString();
    const entries = loadHistory(TEST_APP);
    expect(entries[0].timestamp).toBeDefined();
    expect(entries[0].timestamp >= before).toBe(true);
    expect(entries[0].timestamp <= after).toBe(true);
  });

  it('stores commands with no args', () => {
    appendHistory(TEST_APP, ['dev'], []);
    const entries = loadHistory(TEST_APP);
    expect(entries[0].args).toEqual([]);
  });

  describe('deduplication', () => {
    it('moves duplicate command+args to the top', () => {
      appendHistory(TEST_APP, ['deploy'], ['--env', 'prod']);
      appendHistory(TEST_APP, ['test'], []);
      appendHistory(TEST_APP, ['deploy'], ['--env', 'prod']);
      const entries = loadHistory(TEST_APP);
      expect(entries).toHaveLength(2);
      expect(entries[0].commandPath).toEqual(['deploy']);
      expect(entries[0].args).toEqual(['--env', 'prod']);
      expect(entries[1].commandPath).toEqual(['test']);
    });

    it('treats same command with different args as distinct entries', () => {
      appendHistory(TEST_APP, ['deploy'], ['--env', 'prod']);
      appendHistory(TEST_APP, ['deploy'], ['--env', 'staging']);
      const entries = loadHistory(TEST_APP);
      expect(entries).toHaveLength(2);
    });

    it('treats same args with different command paths as distinct entries', () => {
      appendHistory(TEST_APP, ['db', 'migrate'], ['--env', 'prod']);
      appendHistory(TEST_APP, ['db', 'seed'], ['--env', 'prod']);
      const entries = loadHistory(TEST_APP);
      expect(entries).toHaveLength(2);
    });

    it('updates timestamp when deduplicating', () => {
      appendHistory(TEST_APP, ['dev'], []);
      const firstEntries = loadHistory(TEST_APP);
      const firstTimestamp = firstEntries[0].timestamp;

      // small delay to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 5) {}

      appendHistory(TEST_APP, ['dev'], []);
      const secondEntries = loadHistory(TEST_APP);
      expect(secondEntries).toHaveLength(1);
      expect(secondEntries[0].timestamp >= firstTimestamp).toBe(true);
    });
  });

  describe('entry cap', () => {
    it('caps history at 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        appendHistory(TEST_APP, ['cmd' + i], []);
      }
      const entries = loadHistory(TEST_APP);
      expect(entries).toHaveLength(50);
    });

    it('keeps the most recent entries when capped', () => {
      for (let i = 0; i < 55; i++) {
        appendHistory(TEST_APP, ['cmd' + i], []);
      }
      const entries = loadHistory(TEST_APP);
      expect(entries[0].commandPath).toEqual(['cmd54']);
      expect(entries[49].commandPath).toEqual(['cmd5']);
    });
  });
});

// =============================================================================
// clearHistory
// =============================================================================

describe('clearHistory', () => {
  it('removes history file', () => {
    appendHistory(TEST_APP, ['dev'], []);
    clearHistory(TEST_APP);
    expect(loadHistory(TEST_APP)).toEqual([]);
  });

  it('does not throw when no history exists', () => {
    expect(() => clearHistory(TEST_APP)).not.toThrow();
  });

  it('does not throw when called twice', () => {
    appendHistory(TEST_APP, ['dev'], []);
    clearHistory(TEST_APP);
    expect(() => clearHistory(TEST_APP)).not.toThrow();
  });
});

// =============================================================================
// formatEntryLabel
// =============================================================================

describe('formatEntryLabel', () => {
  it('formats single-segment command without args', () => {
    const label = formatEntryLabel({
      commandPath: ['dev'],
      args: [],
      timestamp: new Date().toISOString(),
    });
    expect(label).toBe('dev');
  });

  it('formats multi-segment command without args', () => {
    const label = formatEntryLabel({
      commandPath: ['db', 'migrate'],
      args: [],
      timestamp: new Date().toISOString(),
    });
    expect(label).toBe('db migrate');
  });

  it('formats command with args', () => {
    const label = formatEntryLabel({
      commandPath: ['deploy'],
      args: ['--env', 'prod'],
      timestamp: new Date().toISOString(),
    });
    expect(label).toBe('deploy --env prod');
  });

  it('formats multi-segment command with args', () => {
    const label = formatEntryLabel({
      commandPath: ['db', 'migrate'],
      args: ['--env', 'staging', '--dry-run'],
      timestamp: new Date().toISOString(),
    });
    expect(label).toBe('db migrate --env staging --dry-run');
  });

  it('handles single-segment command with single arg', () => {
    const label = formatEntryLabel({
      commandPath: ['test'],
      args: ['--watch'],
      timestamp: new Date().toISOString(),
    });
    expect(label).toBe('test --watch');
  });
});

// =============================================================================
// Per-app isolation
// =============================================================================

describe('per-app isolation', () => {
  const OTHER_APP = `pok-history-test-other-${process.pid}`;

  afterEach(() => {
    clearHistory(OTHER_APP);
    const dataDir =
      process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : path.join(os.homedir(), '.local', 'share');
    try {
      fs.rmdirSync(path.join(dataDir, 'pok', OTHER_APP));
    } catch {}
  });

  it('different apps have independent histories', () => {
    appendHistory(TEST_APP, ['dev'], []);
    appendHistory(OTHER_APP, ['deploy'], []);

    const testEntries = loadHistory(TEST_APP);
    const otherEntries = loadHistory(OTHER_APP);

    expect(testEntries).toHaveLength(1);
    expect(testEntries[0].commandPath).toEqual(['dev']);

    expect(otherEntries).toHaveLength(1);
    expect(otherEntries[0].commandPath).toEqual(['deploy']);
  });

  it('clearing one app does not affect another', () => {
    appendHistory(TEST_APP, ['dev'], []);
    appendHistory(OTHER_APP, ['deploy'], []);
    clearHistory(TEST_APP);

    expect(loadHistory(TEST_APP)).toEqual([]);
    expect(loadHistory(OTHER_APP)).toHaveLength(1);
  });
});
