/**
 * State type and helpers for introspect TUI.
 */

export type FileEntry = {
  path: string;
  name: string;
  type: 'file' | 'directory';
  depth: number;
  expanded?: boolean;
};

export type IntrospectState = {
  // File tree
  rootDir: string;
  entries: FileEntry[];
  expandedDirs: Set<string>;

  // Selection
  selectedIndex: number;

  // Preview
  previewContent: string;
  previewScroll: number;

  // UI
  terminalSize: { rows: number; cols: number };
  showHelp: boolean;
};

export function createInitialState(rootDir: string): IntrospectState {
  return {
    rootDir,
    entries: [],
    expandedDirs: new Set(),
    selectedIndex: 0,
    previewContent: '',
    previewScroll: 0,
    terminalSize: { rows: 24, cols: 80 },
    showHelp: false,
  };
}

export function getSelectedEntry(state: IntrospectState): FileEntry | null {
  return state.entries[state.selectedIndex] ?? null;
}

export function getSelectedFilePath(state: IntrospectState): string | null {
  const entry = getSelectedEntry(state);
  if (!entry || entry.type !== 'file') return null;
  return entry.path;
}

export function moveSelection(state: IntrospectState, delta: number): void {
  const newIndex = state.selectedIndex + delta;
  if (newIndex >= 0 && newIndex < state.entries.length) {
    state.selectedIndex = newIndex;
    state.previewScroll = 0;
  }
}

export function toggleDirectory(state: IntrospectState): void {
  const entry = getSelectedEntry(state);
  if (!entry || entry.type !== 'directory') return;

  if (state.expandedDirs.has(entry.path)) {
    state.expandedDirs.delete(entry.path);
  } else {
    state.expandedDirs.add(entry.path);
  }
}

export function scrollPreview(state: IntrospectState, delta: number): void {
  const newScroll = state.previewScroll + delta;
  if (newScroll >= 0) {
    state.previewScroll = newScroll;
  }
}
