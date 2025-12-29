/**
 * File watching utilities for live updates.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type WatcherOptions = {
  pollInterval?: number;
  debounceMs?: number;
};

export type Watcher = {
  stop: () => void;
};

/**
 * Creates a watcher for directory changes.
 * Uses fs.watch with polling fallback for WebContainer compatibility.
 */
export function createWatcher(
  dir: string,
  onChange: () => void,
  options: WatcherOptions = {}
): Watcher {
  const { pollInterval = 500, debounceMs = 100 } = options;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const debouncedOnChange = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      onChange();
      debounceTimer = null;
    }, debounceMs);
  };

  // Try native fs.watch first
  try {
    const watcher = fs.watch(dir, { recursive: true }, () => {
      debouncedOnChange();
    });

    return {
      stop: () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        watcher.close();
      },
    };
  } catch {
    // Fallback to polling for WebContainer or when fs.watch fails
    return createPollingWatcher(dir, debouncedOnChange, pollInterval);
  }
}

/**
 * Polling-based watcher fallback.
 */
function createPollingWatcher(dir: string, onChange: () => void, pollInterval: number): Watcher {
  let lastState = scanDirectoryState(dir);

  const interval = setInterval(() => {
    const currentState = scanDirectoryState(dir);
    if (!statesEqual(currentState, lastState)) {
      lastState = currentState;
      onChange();
    }
  }, pollInterval);

  return {
    stop: () => clearInterval(interval),
  };
}

type FileState = Map<string, number>; // path -> mtime

/**
 * Scans directory and returns map of file paths to mtimes.
 */
function scanDirectoryState(dir: string, maxDepth = 3): FileState {
  const state: FileState = new Map();

  function scan(currentDir: string, depth: number): void {
    if (depth > maxDepth) return;

    let items: string[];
    try {
      items = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const item of items) {
      if (item.startsWith('.')) continue;

      const fullPath = path.join(currentDir, item);
      try {
        const stat = fs.statSync(fullPath);
        state.set(fullPath, stat.mtimeMs);

        if (stat.isDirectory()) {
          scan(fullPath, depth + 1);
        }
      } catch {
        // File may have been deleted
      }
    }
  }

  scan(dir, 0);
  return state;
}

/**
 * Compares two file states for equality.
 */
function statesEqual(a: FileState, b: FileState): boolean {
  if (a.size !== b.size) return false;

  for (const [path, mtime] of a) {
    if (b.get(path) !== mtime) return false;
  }

  return true;
}
