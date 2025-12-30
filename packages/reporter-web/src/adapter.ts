/**
 * Web Reporter Adapter
 *
 * Implements the ReporterAdapter interface for web/React environments.
 * Connects the EventBus to a ReporterStore for state management.
 */

import type { ReporterAdapter, ReporterAdapterController, EventBus } from '@pokjs/core';
import type { ReporterStoreWithHandler } from './store';

/**
 * Create a web reporter adapter that pipes events to a store
 *
 * @param store - The reporter store (must be created with createReporterStore)
 * @returns ReporterAdapter instance
 *
 * @example
 * ```typescript
 * import { createReporterStore, createWebReporterAdapter } from '@pokjs/reporter-web';
 * import { createEventBus } from '@pokjs/core';
 *
 * const store = createReporterStore();
 * const adapter = createWebReporterAdapter(store);
 * const bus = createEventBus();
 *
 * const controller = adapter.start(bus);
 *
 * // Events emitted to the bus will update the store
 * bus.emit({ type: 'root:start', appName: 'my-app' });
 *
 * // In React:
 * // const state = useReporterState(store);
 *
 * // Cleanup
 * controller.stop();
 * ```
 */
export function createWebReporterAdapter(store: ReporterStoreWithHandler): ReporterAdapter {
  return {
    start(bus: EventBus): ReporterAdapterController {
      let stopped = false;

      const unsubscribe = bus.on((event) => {
        if (stopped) return;
        store._handleEvent(event);
      });

      return {
        stop(): void {
          if (stopped) return;
          stopped = true;
          unsubscribe();
        },
      };
    },
  };
}
