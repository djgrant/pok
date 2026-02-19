/**
 * Event Bus
 *
 * The bridge between event emitters (Reporter) and event consumers (Adapters).
 * Provides a simple pub/sub mechanism for CLI events.
 */

import type { CLIEvent, EventListener, Unsubscribe } from './types.js';

/**
 * Event Bus interface - the bridge between emitters and consumers
 */
export interface EventBus {
  /**
   * Emit an event to all listeners
   */
  emit(event: CLIEvent): void;

  /**
   * Subscribe to events
   * @returns Unsubscribe function
   */
  on(listener: EventListener): Unsubscribe;

  /**
   * Subscribe to events
   *
   * @deprecated Use `on(listener)`.
   */
  subscribe(listener: EventListener): Unsubscribe;
}

/**
 * Error handler function type for event bus errors
 */
export type EventBusErrorHandler = (error: unknown, event: CLIEvent) => void;

/**
 * Options for creating an EventBus
 */
export type EventBusOptions = {
  /**
   * Custom error handler for listener errors.
   * If not provided, errors are logged to console.
   * Set to 'throw' to re-throw errors (useful for testing).
   * Set to 'silent' to suppress all error output.
   */
  onError?: EventBusErrorHandler | 'throw' | 'silent';
};

/**
 * Create a new EventBus instance
 *
 * @param options - Optional configuration for error handling
 */
export function createEventBus(options?: EventBusOptions): EventBus {
  const listeners = new Set<EventListener>();
  const { onError } = options ?? {};

  const handleError = (error: unknown, event: CLIEvent): void => {
    if (onError === 'throw') {
      throw error;
    }
    if (onError === 'silent') {
      return;
    }
    if (typeof onError === 'function') {
      onError(error, event);
      return;
    }
    // Default: log to console
    console.error('Error in event listener:', error);
  };

  const emit = (event: CLIEvent): void => {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          handleError(error, event);
        }
      }
    };

  const on = (listener: EventListener): Unsubscribe => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    emit,
    on,
    subscribe: on,
  };
}
