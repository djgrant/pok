/**
 * Reporter Web Store
 *
 * Creates an external store for React integration.
 * Handles all CLIEvent types and maintains normalized state.
 */

import type { CLIEvent, ActivityId, GroupId } from '@openpok/core';
import type {
  ReporterState,
  ReporterStore,
  StateListener,
  ActivityState,
  GroupState,
  LogEntry,
} from './types';

/** Default delay for clearing temporal markers (ms) */
const TEMPORAL_MARKER_DELAY = 600;

/** Counter for generating unique log IDs */
let logIdCounter = 0;

/**
 * Create initial reporter state
 */
function createInitialState(): ReporterState {
  return {
    root: {
      status: 'idle',
    },
    groups: new Map(),
    activities: new Map(),
    logs: [],
    suspended: false,
  };
}

/**
 * Options for creating a reporter store
 */
export type CreateReporterStoreOptions = {
  /** Custom delay for clearing temporal markers (default: 600ms) */
  temporalMarkerDelay?: number;
  /** Disable temporal marker auto-clearing (useful for testing) */
  disableTemporalMarkerClearing?: boolean;
};

/**
 * Type for the store with internal event handler exposed
 */
export type ReporterStoreWithHandler = ReporterStore & {
  _handleEvent: (event: CLIEvent) => void;
};

/**
 * Create a reporter store for React integration
 *
 * @param options - Optional configuration
 * @returns Store compatible with useSyncExternalStore
 */
export function createReporterStore(options?: CreateReporterStoreOptions): ReporterStoreWithHandler {
  const temporalMarkerDelay = options?.temporalMarkerDelay ?? TEMPORAL_MARKER_DELAY;
  const disableTemporalMarkerClearing = options?.disableTemporalMarkerClearing ?? false;

  let state = createInitialState();
  const listeners = new Set<StateListener>();

  /**
   * Notify all listeners of state change
   */
  function notifyListeners(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  /**
   * Schedule clearing of temporal markers for an activity
   */
  function scheduleActivityMarkerClear(activityId: ActivityId, markers: (keyof ActivityState)[]): void {
    if (disableTemporalMarkerClearing) return;

    setTimeout(() => {
      const activity = state.activities.get(activityId);
      if (!activity) return;

      // Check if any markers are still set
      const hasMarkers = markers.some((marker) => activity[marker]);
      if (!hasMarkers) return;

      // Create new state with cleared markers
      const updatedActivity = { ...activity };
      for (const marker of markers) {
        delete updatedActivity[marker];
      }

      const newActivities = new Map(state.activities);
      newActivities.set(activityId, updatedActivity);

      state = {
        ...state,
        activities: newActivities,
      };
      notifyListeners();
    }, temporalMarkerDelay);
  }

  /**
   * Schedule clearing of temporal markers for a group
   */
  function scheduleGroupMarkerClear(groupId: GroupId, markers: (keyof GroupState)[]): void {
    if (disableTemporalMarkerClearing) return;

    setTimeout(() => {
      const group = state.groups.get(groupId);
      if (!group) return;

      // Check if any markers are still set
      const hasMarkers = markers.some((marker) => group[marker]);
      if (!hasMarkers) return;

      // Create new state with cleared markers
      const updatedGroup = { ...group };
      for (const marker of markers) {
        delete updatedGroup[marker];
      }

      const newGroups = new Map(state.groups);
      newGroups.set(groupId, updatedGroup);

      state = {
        ...state,
        groups: newGroups,
      };
      notifyListeners();
    }, temporalMarkerDelay);
  }

  /**
   * Handle a CLI event and update state
   */
  function handleEvent(event: CLIEvent): void {
    switch (event.type) {
      case 'root:start': {
        state = {
          ...state,
          root: {
            status: 'running',
            appName: event.appName,
            version: event.version,
            startedAt: Date.now(),
          },
        };
        notifyListeners();
        break;
      }

      case 'root:end': {
        state = {
          ...state,
          root: {
            ...state.root,
            status: event.exitCode === 0 ? 'complete' : 'error',
            exitCode: event.exitCode,
            endedAt: Date.now(),
          },
        };
        notifyListeners();
        break;
      }

      case 'group:start': {
        const newGroup: GroupState = {
          id: event.id,
          parentId: event.parentId,
          label: event.label,
          layout: event.layout,
          activityIds: [],
          childGroupIds: [],
          hasFailure: false,
          startedAt: Date.now(),
          justStarted_group: true,
        };

        const newGroups = new Map(state.groups);
        newGroups.set(event.id, newGroup);

        // Add to parent's childGroupIds if parent exists
        if (event.parentId) {
          const parent = state.groups.get(event.parentId);
          if (parent) {
            newGroups.set(event.parentId, {
              ...parent,
              childGroupIds: [...parent.childGroupIds, event.id],
            });
          }
        }

        state = {
          ...state,
          groups: newGroups,
        };
        notifyListeners();
        scheduleGroupMarkerClear(event.id, ['justStarted_group']);
        break;
      }

      case 'group:end': {
        const group = state.groups.get(event.id);
        if (!group) break;

        const newGroups = new Map(state.groups);
        newGroups.set(event.id, {
          ...group,
          endedAt: Date.now(),
          justEnded: true,
        });

        state = {
          ...state,
          groups: newGroups,
        };
        notifyListeners();
        scheduleGroupMarkerClear(event.id, ['justEnded']);
        break;
      }

      case 'activity:start': {
        const newActivity: ActivityState = {
          id: event.id,
          parentId: event.parentId,
          label: event.label,
          status: 'running',
          meta: event.meta,
          startedAt: Date.now(),
          justStarted: true,
        };

        const newActivities = new Map(state.activities);
        newActivities.set(event.id, newActivity);

        // Add to parent group's activityIds if parent is a group
        const newGroups = new Map(state.groups);
        if (event.parentId) {
          const parentGroup = state.groups.get(event.parentId as GroupId);
          if (parentGroup) {
            newGroups.set(event.parentId as GroupId, {
              ...parentGroup,
              activityIds: [...parentGroup.activityIds, event.id],
            });
          }
        }

        state = {
          ...state,
          activities: newActivities,
          groups: newGroups,
        };
        notifyListeners();
        scheduleActivityMarkerClear(event.id, ['justStarted']);
        break;
      }

      case 'activity:update': {
        const activity = state.activities.get(event.id);
        if (!activity) break;

        const { progress, message, ...rest } = event.payload;

        const newActivities = new Map(state.activities);
        newActivities.set(event.id, {
          ...activity,
          progress: progress ?? activity.progress,
          message: message ?? activity.message,
          payload: {
            ...activity.payload,
            ...rest,
          },
        });

        state = {
          ...state,
          activities: newActivities,
        };
        notifyListeners();
        break;
      }

      case 'activity:success': {
        const activity = state.activities.get(event.id);
        if (!activity) break;

        const newActivities = new Map(state.activities);
        newActivities.set(event.id, {
          ...activity,
          status: 'success',
          completedAt: Date.now(),
          justCompleted: true,
        });

        state = {
          ...state,
          activities: newActivities,
        };
        notifyListeners();
        scheduleActivityMarkerClear(event.id, ['justCompleted']);
        break;
      }

      case 'activity:failure': {
        const activity = state.activities.get(event.id);
        if (!activity) break;

        const errorMessage = event.error instanceof Error ? event.error.message : String(event.error);

        const newActivities = new Map(state.activities);
        newActivities.set(event.id, {
          ...activity,
          status: 'failure',
          completedAt: Date.now(),
          justFailed: true,
          error: {
            message: errorMessage,
            remediation: event.remediation,
            documentationUrl: event.documentationUrl,
          },
        });

        // Mark parent group as having failure
        const newGroups = new Map(state.groups);
        if (activity.parentId) {
          const parentGroup = state.groups.get(activity.parentId as GroupId);
          if (parentGroup) {
            newGroups.set(activity.parentId as GroupId, {
              ...parentGroup,
              hasFailure: true,
            });
          }
        }

        state = {
          ...state,
          activities: newActivities,
          groups: newGroups,
        };
        notifyListeners();
        scheduleActivityMarkerClear(event.id, ['justFailed']);
        break;
      }

      case 'log': {
        const logEntry: LogEntry = {
          id: `log-${++logIdCounter}`,
          activityId: event.activityId,
          level: event.level,
          message: event.message,
          timestamp: Date.now(),
        };

        state = {
          ...state,
          logs: [...state.logs, logEntry],
        };
        notifyListeners();
        break;
      }

      case 'reporter:suspend': {
        state = {
          ...state,
          suspended: true,
        };
        notifyListeners();
        break;
      }

      case 'reporter:resume': {
        state = {
          ...state,
          suspended: false,
        };
        notifyListeners();
        break;
      }
    }
  }

  return {
    getState(): ReporterState {
      return state;
    },

    getSnapshot(): ReporterState {
      return state;
    },

    getServerSnapshot(): ReporterState {
      return state;
    },

    subscribe(listener: StateListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /**
     * Internal method to handle events - exposed for adapter use
     */
    _handleEvent: handleEvent,
  };
}
