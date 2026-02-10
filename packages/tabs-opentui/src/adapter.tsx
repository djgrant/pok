/**
 * OpenTUI-based Tabs Adapter
 *
 * Implements the TabsAdapter interface using OpenTUI (React for CLI).
 * Also provides an event-driven adapter that renders based on EventBus events.
 */

import * as React from 'react';
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { TabsAdapter, TabSpec, TabsOptions, EventBus } from '@pokit/core';
import { TabsApp } from './tabs-app.js';
import { EventDrivenApp } from './event-driven-app.js';
import { TabsErrorBoundary, restoreTerminal } from './error-boundary.js';

/**
 * Create a tabs adapter using OpenTUI
 */
export function createTabsAdapter(): TabsAdapter {
  return {
    async run(items: TabSpec[], options: TabsOptions): Promise<void> {
      if (!process.stdout.isTTY) {
        throw new Error('Tabbed view requires stdout to be a TTY');
      }

      if (!process.stdin.isTTY) {
        throw new Error('Tabbed view requires stdin to be a TTY for keyboard input');
      }

      if (items.length === 0) {
        return;
      }

      // Clear the main screen before switching to alternate screen buffer.
      // This ensures the menu output is not visible when we return from alternate screen.
      process.stdout.write('\x1b[2J\x1b[H');

      // Ensure stdin is not paused - previous CLI operations (prompts, spinners)
      // may have left it in a paused state
      if (process.stdin.isPaused()) {
        process.stdin.resume();
      }

      // Enable raw mode before OpenTUI starts - this ensures stdin is ready
      // to receive escape sequence responses for capability detection
      process.stdin.setRawMode(true);

      // Let OpenTUI handle alternate screen via its config
      const renderer = await createCliRenderer({
        exitOnCtrlC: false,
        useAlternateScreen: true,
        useMouse: true, // Enable mouse for scroll wheel support
        useKittyKeyboard: {}, // Enable Kitty keyboard protocol for better key handling
      });

      // Disable stdout interception to prevent output mangling with scrolling
      renderer.disableStdoutInterception();

      const root = createRoot(renderer);

      // Start the render loop explicitly
      renderer.start();

      return new Promise<void>((resolve) => {
        let resolved = false;

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
            root.unmount();
            renderer.destroy();
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

        const handleExit = (code: number) => {
          cleanup();
          if (code === 130) {
            process.exit(130);
          }
        };

        // Use React.createElement to bypass OpenTUI's JSX type constraints for class components
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        root.render(
          React.createElement(
            TabsErrorBoundary,
            { onFatalError: handleFatalError },
            React.createElement(TabsApp, { items, options, onExit: handleExit })
          ) as any
        );
      });
    },
  };
}

export type EventAdapterOptions = {
  onExit?: (code: number) => void;
};

/**
 * Create an event-driven adapter that renders based on EventBus events.
 * This adapter builds a state tree from events and renders it using OpenTUI.
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

  let root: ReturnType<typeof createRoot> | null = null;
  let renderer: Awaited<ReturnType<typeof createCliRenderer>> | null = null;
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
      root?.unmount();
      renderer?.destroy();
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

  const init = async () => {
    // Let OpenTUI handle alternate screen and raw mode via its config
    renderer = await createCliRenderer({
      exitOnCtrlC: false,
      useAlternateScreen: true,
      useMouse: false,
      useKittyKeyboard: {}, // Enable Kitty keyboard protocol for better key handling
    });

    // Check if cleanup was requested during async init
    if (isCleanedUp) {
      renderer.destroy();
      return;
    }

    // Disable stdout interception to prevent output mangling with scrolling
    renderer.disableStdoutInterception();
    root = createRoot(renderer);

    // Start the render loop explicitly
    renderer.start();

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

    // Use React.createElement to bypass OpenTUI's JSX type constraints for class components
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    root.render(
      React.createElement(
        TabsErrorBoundary,
        { onFatalError: handleFatalError },
        React.createElement(EventDrivenApp, { bus, onExit: handleExit })
      ) as any
    );
  };

  init().catch((error) => {
    console.error('Failed to initialize event adapter:', error);
    restoreTerminal();
  });

  return {
    unmount: cleanup,
  };
}
