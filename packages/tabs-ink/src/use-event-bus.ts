/**
 * React Hook for EventBus
 *
 * Provides a hook to subscribe to EventBus events and manage state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { EventBus, CLIEvent } from '@openpok/core';
import type { EventDrivenState } from './types.js';
import { createInitialState, reducer } from './state-reducer.js';

/**
 * Hook to subscribe to EventBus and manage state
 */
export function useEventBus(bus: EventBus): EventDrivenState {
  const [state, setState] = useState<EventDrivenState>(createInitialState);

  const handleEvent = useCallback((event: CLIEvent) => {
    setState((prevState) => reducer(prevState, event));
  }, []);

  useEffect(() => {
    const unsubscribe = bus.on(handleEvent);
    return unsubscribe;
  }, [bus, handleEvent]);

  return state;
}
