/**
 * Ink-based Tabs Adapter
 *
 * Implements the TabsAdapter interface using Ink (React for CLI).
 * Also provides an event-driven adapter that renders based on EventBus events.
 */
import { render, type RenderOptions } from 'ink';
import type { TabsAdapter, TabSpec, TabsOptions, EventBus } from '@pokit/core';
import { TabsApp } from './tabs-app.js';
import { EventDrivenApp } from './event-driven-app.js';
import { TabsErrorBoundary, restoreTerminal } from './error-boundary.js';

/**
 * Create a tabs adapter using Ink
 */
export function createTabsAdapter(): TabsAdapter {
  return {
    async run(items: TabSpec[], options: TabsOptions): Promise<void> {
      // Check stdout TTY
      if (!process.stdout.isTTY) {
        throw new Error('Tabbed view requires stdout to be a TTY');
      }

      // Check stdin TTY - required for keyboard input
      if (!process.stdin.isTTY) {
        throw new Error('Tabbed view requires stdin to be a TTY for keyboard input');
      }

      // Empty items - nothing to do
      if (items.length === 0) {
        return;
      }

      // Switch to alternate screen buffer (like vim/less)
      // This preserves the main terminal content and provides a clean canvas
      process.stdout.write('\x1b[?1049h\x1b[H');

      // Ensure stdin is not paused - previous CLI operations (prompts, spinners)
      // may have left it in a paused state
      if (process.stdin.isPaused()) {
        process.stdin.resume();
      }

      // Enable raw mode before Ink starts - Ink's internal ref counting may be
      // out of sync if previous CLI operations (clack prompts/spinners) didn't
      // properly balance their setRawMode calls
      process.stdin.setRawMode(true);

      return new Promise<void>((resolve) => {
        let resolved = false;
        let unmount: (() => void) | null = null;
        let clear: (() => void) | null = null;

        // Cleanup function to restore terminal and resolve
        const cleanup = () => {
          if (resolved) return;
          resolved = true;

          // Remove signal handlers
          process.removeListener('SIGINT', handleSignal);
          process.removeListener('SIGTERM', handleSignal);
          process.removeListener('SIGQUIT', handleSignal);
          process.removeListener('uncaughtException', handleUncaughtException);

          try {
            clear?.();
            unmount?.();
          } catch {
            // Ignore errors during cleanup
          }

          restoreTerminal();
          resolve();
        };

        // Signal handler for graceful shutdown
        const handleSignal = () => {
          cleanup();
          process.exit(0);
        };

        // Handle uncaught exceptions
        const handleUncaughtException = (error: Error) => {
          restoreTerminal();
          console.error('\n[TabsUI] Uncaught exception:', error);
          cleanup();
          process.exit(1);
        };

        // Register signal handlers
        process.on('SIGINT', handleSignal);
        process.on('SIGTERM', handleSignal);
        process.on('SIGQUIT', handleSignal);
        process.on('uncaughtException', handleUncaughtException);

        // Handle fatal errors from error boundary
        const handleFatalError = () => {
          cleanup();
        };

        const result = render(
          <TabsErrorBoundary onFatalError={handleFatalError}>
            <TabsApp
              items={items}
              options={options}
              onExit={(code) => {
                cleanup();
                if (code === 130) {
                  process.exit(130);
                }
              }}
            />
          </TabsErrorBoundary>,
          {
            exitOnCtrlC: false, // We handle quit ourselves
            incrementalRendering: true, // Only update changed lines to reduce flicker
          } as RenderOptions
        );

        unmount = result.unmount;
        clear = result.clear;

        // Also resolve when ink exits naturally
        result.waitUntilExit().then(() => {
          if (!resolved) {
            cleanup();
          }
        });
      });
    },
  };
}

// =============================================================================
// Event-Driven Adapter
// =============================================================================

export type EventAdapterOptions = {
  onExit?: (code: number) => void;
};

/**
 * Create an event-driven adapter that renders based on EventBus events.
 * This adapter builds a state tree from events and renders it using Ink.
 *
 * @param bus - The EventBus to listen to
 * @param options - Options for the adapter
 * @returns Object with unmount function to stop the adapter
 */
export function createEventAdapter(
  bus: EventBus,
  options: EventAdapterOptions = {}
): { unmount: () => void } {
  if (!process.stdout.isTTY) {
    throw new Error('Event-driven tabs view requires stdout to be a TTY');
  }

  if (!process.stdin.isTTY) {
    throw new Error('Event-driven tabs view requires stdin to be a TTY for keyboard input');
  }

  process.stdout.write('\x1b[?1049h\x1b[H');

  let isCleanedUp = false;

  // Cleanup function to restore terminal
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    // Remove signal handlers
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
    process.removeListener('SIGQUIT', handleSignal);
    process.removeListener('uncaughtException', handleUncaughtException);

    try {
      clear();
      unmount();
    } catch {
      // Ignore errors during cleanup
    }

    restoreTerminal();
  };

  // Signal handler for graceful shutdown
  const handleSignal = () => {
    cleanup();
    process.exit(0);
  };

  // Handle uncaught exceptions
  const handleUncaughtException = (error: Error) => {
    restoreTerminal();
    console.error('\n[TabsUI] Uncaught exception:', error);
    cleanup();
    process.exit(1);
  };

  // Register signal handlers
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  process.on('SIGQUIT', handleSignal);
  process.on('uncaughtException', handleUncaughtException);

  const handleExit = (code: number) => {
    cleanup();
    options.onExit?.(code);
    if (code === 130) {
      process.exit(130);
    }
  };

  // Handle fatal errors from error boundary
  const handleFatalError = () => {
    cleanup();
  };

  const { unmount, clear } = render(
    <TabsErrorBoundary onFatalError={handleFatalError}>
      <EventDrivenApp bus={bus} onExit={handleExit} />
    </TabsErrorBoundary>,
    {
      exitOnCtrlC: false,
      incrementalRendering: true,
    } as RenderOptions
  );

  return {
    unmount: cleanup,
  };
}
