/**
 * Introspect TUI - Live file viewer for pok commands directory
 *
 * A read-only TUI that displays a file tree with syntax-highlighted
 * preview and live updates when files change.
 *
 * This is purpose-built for the playground and doesn't have a
 * defineCommand wrapper.
 */

// Main entry point
export { runIntrospect } from './introspect';
export type { IntrospectOptions } from './introspect';

// State types and helpers
export {
  createInitialState,
  getSelectedEntry,
  getSelectedFilePath,
  moveSelection,
  toggleDirectory,
  scrollPreview,
} from './state';
export type { FileEntry, IntrospectState } from './state';

// Tree utilities
export { scanDirectory, refreshTree, readFileContent } from './tree';
export type { ScanOptions } from './tree';

// Rendering
export { render, showCursor, clearScreen } from './render';

// Input handling
export { setupInput } from './input';
export type { InputHandlers } from './input';

// File watching
export { createWatcher } from './watcher';
export type { Watcher, WatcherOptions } from './watcher';

// Syntax highlighting
export { highlightCode } from './highlight';
