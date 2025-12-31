/**
 * React Hook for EventBus
 *
 * Provides a hook to subscribe to EventBus events and manage state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { EventBus, CLIEvent } from '@pokit/core';
import type { EventDrivenState } from '@pokit/tabs-core';
import { createInitialState, reducer } from '@pokit/tabs-core';

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
