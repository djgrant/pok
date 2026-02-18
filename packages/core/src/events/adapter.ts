/**
 * Reporter Adapter Interface
 *
 * Defines the contract for output rendering adapters.
 * Adapters consume events from the EventBus and render them to the terminal.
 *
 * Implementations:
 * - @pokit/reporter-clack (Clack-based, sequential output)
 * - Custom reporter adapters (for alternative rendering strategies)
 */

import type { EventBus } from './bus';

/**
 * Controller returned by ReporterAdapter.start()
 */
export interface ReporterAdapterController {
  /**
   * Stop the adapter and clean up resources.
   */
  stop(): void;
}

/**
 * Reporter Adapter Interface
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
