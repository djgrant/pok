/**
 * Event Bus
 *
 * The bridge between event emitters (Reporter) and event consumers (Adapters).
 * Provides a simple pub/sub mechanism for CLI events.
 */

import type { CLIEvent } from './types.js';

/**
 * Event listener function type
 */
export type EventListener = (event: CLIEvent) => void;

/**
 * Unsubscribe function returned by `on()`
 */
export type Unsubscribe = () => void;

/**
 * The Event Bus interface - the bridge between emitters and consumers
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
}

/**
 * Create a new EventBus instance
 */
export function createEventBus(): EventBus {
  const listeners = new Set<EventListener>();

  return {
    emit(event: CLIEvent): void {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      }
    },

    on(listener: EventListener): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
