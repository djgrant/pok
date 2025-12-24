export { createTabsAdapter, createEventAdapter } from './adapter.js';
export type { EventAdapterOptions } from './adapter.js';

export { useEventBus } from './use-event-bus.js';
export {
  createInitialState,
  reducer,
  getTabsGroupActivities,
  findTabsGroup,
} from './state-reducer.js';
export type { ActivityNode, GroupNode, EventDrivenState } from './types.js';
