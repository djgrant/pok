/**
 * File tree building utilities.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FileEntry, IntrospectState } from './state';

export type ScanOptions = {
  maxDepth?: number;
};

/**
 * Scans a directory and returns a flat list of file entries.
 * Entries are sorted: directories first, then files, both alphabetically.
 */
export function scanDirectory(
  dir: string,
  expandedDirs: Set<string>,
  options: ScanOptions = {}
): FileEntry[] {
  const { maxDepth = 3 } = options;
  const entries: FileEntry[] = [];

  function scan(currentDir: string, depth: number): void {
    if (depth > maxDepth) return;

    let items: string[];
    try {
      items = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    // Sort: directories first, then files, both alphabetically
    const sorted = items.sort((a, b) => {
      const aPath = path.join(currentDir, a);
      const bPath = path.join(currentDir, b);
      const aIsDir = isDirectory(aPath);
      const bIsDir = isDirectory(bPath);

      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (const item of sorted) {
      // Skip hidden files
      if (item.startsWith('.')) continue;

      const fullPath = path.join(currentDir, item);
      const isDir = isDirectory(fullPath);

      entries.push({
        path: fullPath,
        name: item,
        type: isDir ? 'directory' : 'file',
        depth,
        expanded: isDir ? expandedDirs.has(fullPath) : undefined,
      });

      // Recurse into expanded directories
      if (isDir && expandedDirs.has(fullPath)) {
        scan(fullPath, depth + 1);
      }
    }
  }

  scan(dir, 0);
  return entries;
}

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Updates the state with a fresh file tree scan.
 * Preserves selection if possible.
 */
export function refreshTree(state: IntrospectState, options?: ScanOptions): void {
  const previousSelected = state.entries[state.selectedIndex]?.path;
  state.entries = scanDirectory(state.rootDir, state.expandedDirs, options);

  // Try to preserve selection
  if (previousSelected) {
    const newIndex = state.entries.findIndex((e) => e.path === previousSelected);
    if (newIndex !== -1) {
      state.selectedIndex = newIndex;
    } else {
      // Selected file was deleted, clamp to valid range
      state.selectedIndex = Math.min(state.selectedIndex, Math.max(0, state.entries.length - 1));
    }
  } else {
    state.selectedIndex = 0;
  }
}

/**
 * Reads file content for preview.
 */
export function readFileContent(filePath: string, maxLines = 1000): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '\n... (truncated)';
    }
    return content;
  } catch {
    return '(Unable to read file)';
  }
}
