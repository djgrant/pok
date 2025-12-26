export { createTabsAdapter, createEventAdapter } from './adapter.js';
export type { EventAdapterOptions } from './adapter.js';

export { useEventBus } from './use-event-bus.js';

// Re-export state management from @openpok/tabs-core (single source of truth)
export {
  createInitialState,
  reducer,
  getTabsGroupActivities,
  findTabsGroup,
} from '@openpok/tabs-core';

// Re-export types from local types.ts (which re-exports from tabs-core + adds Ink-specific types)
export type { ActivityNode, GroupNode, EventDrivenState, TabProcess } from './types.js';
