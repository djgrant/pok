/**
 * Raw Reporter Adapter
 *
 * A minimal reporter adapter that captures all events without any terminal output.
 * Designed for testing - allows assertions on emitted events.
 */

import type { EventBus } from './bus';
import type { CLIEvent } from './types';
import type { ReporterAdapter, ReporterAdapterController } from './adapter';

/**
 * Options for the raw reporter adapter
 */
export type RawReporterAdapterOptions = {
  /** Optional callback fired for each event */
  onEvent?: (event: CLIEvent) => void;
};

/**
 * Extended controller with event access methods
 */
export interface RawReporterAdapterController extends ReporterAdapterController {
  /** Get all captured events */
  getEvents(): CLIEvent[];
  /** Clear captured events */
  clearEvents(): void;
}

/**
 * Raw reporter adapter interface with typed start method
 */
export interface RawReporterAdapter extends ReporterAdapter {
  start(bus: EventBus): RawReporterAdapterController;
}

/**
 * Create a raw reporter adapter for testing
 *
 * Captures all events without any terminal output.
 * Use getEvents() on the controller to inspect captured events.
 *
 * @example
 * ```ts
 * const adapter = createRawReporterAdapter();
 * const controller = adapter.start(eventBus);
 *
 * // ... run some commands ...
 *
 * const events = controller.getEvents();
 * expect(events).toContainEqual({ type: 'activity:success', id: expect.any(String) });
 * ```
 */
export function createRawReporterAdapter(
  options: RawReporterAdapterOptions = {}
): RawReporterAdapter {
  return {
    start(bus: EventBus): RawReporterAdapterController {
      const events: CLIEvent[] = [];

      const handleEvent = (event: CLIEvent): void => {
        events.push(event);
        options.onEvent?.(event);
      };

      const unsubscribe = bus.on(handleEvent);

      return {
        stop(): void {
          unsubscribe();
        },

        getEvents(): CLIEvent[] {
          return events;
        },

        clearEvents(): void {
          events.length = 0;
        },
      };
    },
  };
}
