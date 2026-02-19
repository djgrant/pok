/**
 * OpenTUI-based Tabs Adapter
 *
 * Implements the TabsAdapter interface using OpenTUI (React for CLI).
 * Also provides an event-driven adapter that renders based on EventBus events.
 */

import * as React from 'react';
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { TabsAdapter, TabSpec, TabsOptions, EventBus, AppAdapter, AnyComponent } from '@pokit/core';
import { CancelError } from '@pokit/core';
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

       return new Promise<void>((resolve, reject) => {
         let settled = false;

         const cleanup = () => {
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
         };

         const resolveOnce = () => {
           if (settled) return;
           settled = true;
           cleanup();
           resolve();
         };

         const rejectOnce = (error: unknown) => {
           if (settled) return;
           settled = true;
           cleanup();
           reject(error);
         };

         // Signal handler for graceful shutdown
         const handleSignal = () => {
           rejectOnce(new CancelError());
         };

         // Handle uncaught exceptions
         const handleUncaughtException = (error: Error) => {
           console.error('\n[TabsUI] Uncaught exception:', error);
           rejectOnce(error);
         };

         // Register signal handlers
         process.on('SIGINT', handleSignal);
         process.on('SIGTERM', handleSignal);
         process.on('SIGQUIT', handleSignal);
         process.on('uncaughtException', handleUncaughtException);

         // Handle fatal errors from error boundary
         const handleFatalError = () => {
           rejectOnce(new Error('[TabsUI] Fatal error'));
         };

         const handleExit = (code: number) => {
           if (code === 130) {
             rejectOnce(new CancelError());
             return;
           }
           resolveOnce();
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
    options.onExit?.(130);
  };

  // Handle uncaught exceptions
  const handleUncaughtException = (error: Error) => {
    restoreTerminal();
    console.error('\n[TabsUI] Uncaught exception:', error);
    cleanup();
    options.onExit?.(1);
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

/**
 * Create an app adapter for rendering custom fullscreen TUI applications.
 * Handles terminal lifecycle (alternate screen, raw mode, signals, cleanup).
 */
export function createAppAdapter(): AppAdapter {
  return {
    async run<TProps>(
      component: AnyComponent<TProps>,
      props: TProps
    ): Promise<void> {
      if (!process.stdout.isTTY) {
        throw new Error('App view requires stdout to be a TTY');
      }

      if (!process.stdin.isTTY) {
        throw new Error('App view requires stdin to be a TTY for keyboard input');
      }

      // Clear the main screen before switching to alternate screen buffer
      process.stdout.write('\x1b[2J\x1b[H');

      // Ensure stdin is not paused
      if (process.stdin.isPaused()) {
        process.stdin.resume();
      }

      // Enable raw mode before OpenTUI starts
      process.stdin.setRawMode(true);

      const renderer = await createCliRenderer({
        exitOnCtrlC: false,
        useAlternateScreen: true,
        useMouse: true,
        useKittyKeyboard: {},
      });

      renderer.disableStdoutInterception();

      const root = createRoot(renderer);
      renderer.start();

      return new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
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
        };

        const resolveOnce = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };

        const rejectOnce = (error: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };

        const handleSignal = () => {
          rejectOnce(new CancelError());
        };

        const handleUncaughtException = (error: Error) => {
          console.error('\n[AppUI] Uncaught exception:', error);
          rejectOnce(error);
        };

        process.on('SIGINT', handleSignal);
        process.on('SIGTERM', handleSignal);
        process.on('SIGQUIT', handleSignal);
        process.on('uncaughtException', handleUncaughtException);

        const handleFatalError = () => {
          rejectOnce(new Error('[AppUI] Fatal error'));
        };

        const userOnExit =
          typeof props === 'object' && props !== null && 'onExit' in props
            ? (props as { onExit?: (code?: number) => void }).onExit
            : undefined;

        // Inject onExit for app-controlled shutdown. It remains optional for callers.
        const wrappedProps = {
          ...props,
          onExit: (code?: number) => {
            userOnExit?.(code);
            if (code === 130) {
              rejectOnce(new CancelError());
              return;
            }
            resolveOnce();
          },
        };

        root.render(
          React.createElement(
            TabsErrorBoundary,
            { onFatalError: handleFatalError },
            React.createElement(component as any, wrappedProps as any)
          ) as any
        );
      });
    },
  };
}
