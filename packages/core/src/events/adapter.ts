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
 *
 * ## Lifecycle Contract
 *
 * The controller manages the lifecycle of an active reporter adapter:
 *
 * 1. A controller is created when `ReporterAdapter.start()` is called
 * 2. The controller remains active until `stop()` is called
 * 3. After `stop()`, the controller is considered "stopped" and should not process events
 *
 * ## Behavioral Requirements
 *
 * ### Idempotency
 * - `stop()` MUST be idempotent: calling it multiple times MUST NOT throw
 * - After the first `stop()` call, subsequent calls MUST be no-ops
 *
 * ### Resource Cleanup
 * - `stop()` MUST unsubscribe from the EventBus
 * - `stop()` MUST release any terminal resources (e.g., restore cursor, clear alternate screen)
 * - `stop()` MUST complete synchronously or ensure cleanup happens before returning
 *
 * ### Events After Stop
 * - Events received after `stop()` MUST be ignored silently
 * - The adapter MUST NOT throw or log errors for post-stop events
 */
export interface ReporterAdapterController {
  /**
   * Stop the adapter and clean up resources.
   *
   * For Clack: unsubscribes from the event bus.
   * For Ink: unmounts the React app and restores terminal state.
   *
   * ## Contract
   * - MUST be idempotent (safe to call multiple times)
   * - MUST unsubscribe from the EventBus
   * - MUST release all terminal resources
   * - MUST NOT throw under any circumstances
   *
   * @example
   * ```typescript
   * const controller = adapter.start(bus);
   *
   * // Later, clean up
   * controller.stop();
   *
   * // Safe to call again (idempotent)
   * controller.stop(); // No-op, does not throw
   * ```
   */
  stop(): void;
}

/**
 * Reporter Adapter Interface
 *
 * Adapters are event consumers that render CLI output.
 * They subscribe to the EventBus and translate events into terminal output.
 *
 * ## Lifecycle Contract
 *
 * 1. `start()` MUST be called exactly once per adapter instance
 * 2. `start()` returns a controller that MUST have `stop()` called for cleanup
 * 3. Calling `start()` multiple times on the same instance is undefined behavior
 *
 * ## Event Handling Contract
 *
 * ### Event Ordering
 * - Events MUST be processed in the order they are received from the EventBus
 * - Adapters MUST NOT reorder, buffer indefinitely, or drop events (except after stop)
 *
 * ### Error Handling
 * - Event processing MUST NOT throw exceptions
 * - Errors during rendering MUST be logged internally or ignored
 * - A single event failure MUST NOT prevent processing of subsequent events
 *
 * ### Unknown Events
 * - Unknown event types MUST be ignored silently (forward compatibility)
 * - Adapters MUST NOT throw or log errors for unrecognized event types
 *
 * ## Process Exit Handling
 *
 * - If the process exits before `stop()` is called, adapters SHOULD clean up resources
 * - Adapters MAY register process exit handlers to ensure cleanup
 * - SIGINT/SIGTERM SHOULD trigger graceful shutdown if possible
 *
 * ## Implementation Notes
 *
 * Adapters typically:
 * 1. Subscribe to the EventBus in `start()`
 * 2. Maintain internal state for rendering (e.g., current group, spinner state)
 * 3. Update terminal output based on events
 * 4. Clean up subscriptions and terminal state in `stop()`
 */
export interface ReporterAdapter {
  /**
   * Start listening to the EventBus and rendering output.
   *
   * ## Contract
   * - MUST subscribe to the EventBus and begin processing events
   * - MUST return a controller for lifecycle management
   * - MUST NOT throw during normal operation
   * - SHOULD be called exactly once per adapter instance
   *
   * ## Error Handling
   * - If subscription fails, MAY throw an error
   * - Once started, event processing errors MUST be handled internally
   *
   * @param bus - The EventBus to subscribe to
   * @returns Controller object with stop() method to clean up
   *
   * @example
   * ```typescript
   * const adapter = createClackReporter();
   * const controller = adapter.start(bus);
   *
   * // Run your command...
   *
   * // Always clean up when done
   * controller.stop();
   * ```
   */
  start(bus: EventBus): ReporterAdapterController;
}
