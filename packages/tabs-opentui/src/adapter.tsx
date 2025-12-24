/**
 * OpenTUI-based Tabs Adapter
 *
 * Implements the TabsAdapter interface using OpenTUI (React for CLI).
 * Also provides an event-driven adapter that renders based on EventBus events.
 */

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type {
  TabsAdapter,
  TabSpec,
  TabsOptions,
  EventBus,
} from '@openpok/core';
import { TabsApp } from './tabs-app.js';
import { EventDrivenApp } from './event-driven-app.js';

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
        throw new Error(
          'Tabbed view requires stdin to be a TTY for keyboard input'
        );
      }

      if (items.length === 0) {
        return;
      }

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
        const handleExit = () => {
          root.unmount();
          renderer.destroy();
          resolve();
        };

        root.render(
          <TabsApp items={items} options={options} onExit={handleExit} />
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
    throw new Error(
      'Event-driven tabs view requires stdin to be a TTY for keyboard input'
    );
  }

  let root: ReturnType<typeof createRoot> | null = null;
  let renderer: Awaited<ReturnType<typeof createCliRenderer>> | null = null;

  const init = async () => {
    // Let OpenTUI handle alternate screen and raw mode via its config
    renderer = await createCliRenderer({
      exitOnCtrlC: false,
      useAlternateScreen: true,
      useMouse: false,
      useKittyKeyboard: {}, // Enable Kitty keyboard protocol for better key handling
    });

    // Disable stdout interception to prevent output mangling with scrolling
    renderer.disableStdoutInterception();
    root = createRoot(renderer);

    // Start the render loop explicitly
    renderer.start();

    const handleExit = (code: number) => {
      root?.unmount();
      renderer?.destroy();
      options.onExit?.(code);
    };

    root.render(<EventDrivenApp bus={bus} onExit={handleExit} />);
  };

  init();

  return {
    unmount: () => {
      root?.unmount();
      renderer?.destroy();
    },
  };
}
