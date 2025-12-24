/**
 * Ink-based Tabs Adapter
 *
 * Implements the TabsAdapter interface using Ink (React for CLI).
 * Also provides an event-driven adapter that renders based on EventBus events.
 */
import { render, type RenderOptions } from 'ink';
import type { TabsAdapter, TabSpec, TabsOptions, EventBus } from '@openpok/core';
import { TabsApp } from './tabs-app.js';
import { EventDrivenApp } from './event-driven-app.js';

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
        const { unmount, waitUntilExit, clear } = render(
          <TabsApp
            items={items}
            options={options}
            onExit={() => {
              clear();
              unmount();
              // Switch back to main screen buffer (restores previous terminal content)
              process.stdout.write('\x1b[?1049l');
              resolve();
            }}
          />,
          {
            exitOnCtrlC: false, // We handle quit ourselves
            incrementalRendering: true, // Only update changed lines to reduce flicker
          } as RenderOptions
        );

        // Also resolve when ink exits naturally
        waitUntilExit().then(() => resolve());
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

  const handleExit = (code: number) => {
    clear();
    unmount();
    process.stdout.write('\x1b[?1049l');
    options.onExit?.(code);
  };

  const { unmount, clear } = render(<EventDrivenApp bus={bus} onExit={handleExit} />, {
    exitOnCtrlC: false,
    incrementalRendering: true,
  } as RenderOptions);

  return { unmount };
}
