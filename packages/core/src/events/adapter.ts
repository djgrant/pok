/**
 * Reporter Adapter Interface
 *
 * Defines the contract for output rendering adapters.
 * Adapters consume events from the EventBus and render them to the terminal.
 *
 * Implementations:
 * - @openpok/reporter-clack (Clack-based, sequential output)
 * - @openpok/core-reporter-ink (Ink/React-based, for complex layouts like tabs)
 */

import type { EventBus } from './bus';

/**
 * Controller returned by ReporterAdapter.start()
 * Allows stopping the adapter and cleaning up resources.
 */
export interface ReporterAdapterController {
  /**
   * Stop the adapter and clean up resources.
   * For Clack: unsubscribes from the event bus.
   * For Ink: unmounts the React app and restores terminal state.
   */
  stop(): void;
}

/**
 * Reporter Adapter Interface
 *
 * Adapters are event consumers that render CLI output.
 * They subscribe to the EventBus and translate events into terminal output.
 */
export interface ReporterAdapter {
  /**
   * Start listening to the EventBus and rendering output.
   *
   * @param bus - The EventBus to subscribe to
   * @returns Controller object with stop() method to clean up
   */
  start(bus: EventBus): ReporterAdapterController;
}
