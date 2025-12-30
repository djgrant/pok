import { useRef, useCallback } from 'react';

export type PlaygroundEvent =
  | { type: 'file:created'; path: string }
  | { type: 'file:updated'; path: string }
  | { type: 'file:deleted'; path: string }
  | { type: 'clipboard:copy'; content: string }
  | { type: 'tab:open'; filePath: string }
  | { type: 'tree:refresh' }
  | { type: 'terminal:run'; command: string };

export type EventType = PlaygroundEvent['type'];

type EventCallback = (event: PlaygroundEvent) => void;

type Listeners = Map<EventType, Set<EventCallback>>;

export type UseEventBusResult = {
  emit: (event: PlaygroundEvent) => void;
  subscribe: (type: EventType, callback: EventCallback) => () => void;
};

export function useEventBus(): UseEventBusResult {
  const listenersRef = useRef<Listeners>(new Map());

  const emit = useCallback((event: PlaygroundEvent) => {
    const listeners = listenersRef.current.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
  }, []);

  const subscribe = useCallback((type: EventType, callback: EventCallback) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    const listeners = listenersRef.current.get(type)!;
    listeners.add(callback);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        listenersRef.current.delete(type);
      }
    };
  }, []);

  return { emit, subscribe };
}
