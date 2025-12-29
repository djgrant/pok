/**
 * Main introspect TUI loop.
 */

import * as path from 'node:path';
import {
  createInitialState,
  moveSelection,
  toggleDirectory,
  scrollPreview,
  getSelectedFilePath,
} from './state';
import { refreshTree, readFileContent } from './tree';
import { render, showCursor, clearScreen } from './render';
import { setupInput } from './input';
import { createWatcher } from './watcher';

export type IntrospectOptions = {
  /** Directory to watch (default: commands/) */
  path?: string;
  /** Maximum depth for file tree (default: 3) */
  depth?: number;
  /** Poll interval in ms for file watching (default: 500) */
  pollInterval?: number;
};

/**
 * Runs the introspect TUI.
 * Returns a promise that resolves when the user quits.
 */
export async function runIntrospect(options: IntrospectOptions = {}): Promise<void> {
  const rootDir = path.resolve(options.path ?? 'commands');
  const maxDepth = options.depth ?? 3;

  const state = createInitialState(rootDir);

  // Get terminal size
  const stdout = process.stdout;
  const stdin = process.stdin;

  const updateTerminalSize = (): void => {
    state.terminalSize = {
      rows: stdout.rows ?? 24,
      cols: stdout.columns ?? 80,
    };
  };

  updateTerminalSize();

  // Handle terminal resize
  stdout.on('resize', () => {
    updateTerminalSize();
    renderUI();
  });

  // Initial tree scan
  refreshTree(state, { maxDepth });

  // Get preview content
  const getPreviewContent = (): string => {
    const filePath = getSelectedFilePath(state);
    if (!filePath) {
      const entry = state.entries[state.selectedIndex];
      if (entry?.type === 'directory') {
        return '(Select a file to preview)';
      }
      return '(No file selected)';
    }
    return readFileContent(filePath);
  };

  // Render function
  const renderUI = (): void => {
    const content = getPreviewContent();
    render(state, stdout, content);
  };

  // File watcher
  const watcher = createWatcher(
    rootDir,
    () => {
      refreshTree(state, { maxDepth });
      renderUI();
    },
    { pollInterval: options.pollInterval }
  );

  // Promise to wait for quit
  return new Promise<void>((resolve) => {
    // Signal handler references (defined before cleanup so they can be removed)
    let handleSignal: (() => void) | null = null;

    const cleanup = (): void => {
      // Remove signal handlers to prevent accumulation
      if (handleSignal) {
        process.off('SIGINT', handleSignal);
        process.off('SIGTERM', handleSignal);
      }
      cleanupInput();
      watcher.stop();
      showCursor(stdout);
      clearScreen(stdout);
    };

    // Input handlers
    const cleanupInput = setupInput(stdin, {
      onUp: () => {
        moveSelection(state, -1);
        renderUI();
      },
      onDown: () => {
        moveSelection(state, 1);
        renderUI();
      },
      onEnter: () => {
        toggleDirectory(state);
        refreshTree(state, { maxDepth });
        renderUI();
      },
      onPageUp: () => {
        scrollPreview(state, -10);
        renderUI();
      },
      onPageDown: () => {
        scrollPreview(state, 10);
        renderUI();
      },
      onHelp: () => {
        state.showHelp = !state.showHelp;
        renderUI();
      },
      onQuit: () => {
        cleanup();
        resolve();
      },
    });

    // Handle process termination
    handleSignal = () => {
      cleanup();
      resolve();
    };
    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    // Initial render
    renderUI();
  });
}
