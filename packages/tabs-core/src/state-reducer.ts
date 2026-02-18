/**
 * State Reducer for Event-Driven CLI
 *
 * Builds a state tree from CLI events using a reducer pattern.
 * Framework-agnostic reducer used by tabs adapters.
 */

import type { CLIEvent, ActivityId, GroupId } from '@pokit/core';
import type { EventDrivenState, ActivityNode, GroupNode } from './types.js';

/**
 * Create initial state
 */
export function createInitialState(): EventDrivenState {
  return {
    appName: undefined,
    version: undefined,
    exitCode: undefined,
    activities: new Map(),
    groups: new Map(),
    rootChildren: [],
  };
}

/**
 * Reducer function for CLI events
 */
export function reducer(state: EventDrivenState, event: CLIEvent): EventDrivenState {
  switch (event.type) {
    case 'root:start':
      return {
        ...state,
        appName: event.appName,
        version: event.version,
      };

    case 'root:end':
      return {
        ...state,
        exitCode: event.exitCode,
      };

    case 'group:start': {
      const newGroup: GroupNode = {
        type: 'group',
        id: event.id,
        parentId: event.parentId,
        label: event.label,
        layout: event.layout,
        children: [],
      };

      const newGroups = new Map(state.groups);
      newGroups.set(event.id, newGroup);

      if (event.parentId) {
        const parentGroup = state.groups.get(event.parentId);
        if (parentGroup) {
          const updatedParent: GroupNode = {
            ...parentGroup,
            children: [...parentGroup.children, event.id],
          };
          newGroups.set(event.parentId, updatedParent);
        }
        return { ...state, groups: newGroups };
      }

      return {
        ...state,
        groups: newGroups,
        rootChildren: [...state.rootChildren, event.id],
      };
    }

    case 'group:end':
      return state;

    case 'activity:start': {
      const newActivity: ActivityNode = {
        type: 'activity',
        id: event.id,
        parentId: event.parentId,
        label: event.label,
        status: 'running',
        meta: event.meta,
        logs: [],
      };

      const newActivities = new Map(state.activities);
      newActivities.set(event.id, newActivity);

      if (event.parentId) {
        const parentGroup = state.groups.get(event.parentId as GroupId);
        if (parentGroup) {
          const newGroups = new Map(state.groups);
          const updatedParent: GroupNode = {
            ...parentGroup,
            children: [...parentGroup.children, event.id],
          };
          newGroups.set(event.parentId as GroupId, updatedParent);
          return { ...state, activities: newActivities, groups: newGroups };
        }
        return { ...state, activities: newActivities };
      }

      return {
        ...state,
        activities: newActivities,
        rootChildren: [...state.rootChildren, event.id],
      };
    }

    case 'activity:update': {
      const activity = state.activities.get(event.id);
      if (!activity) return state;

      const updatedActivity: ActivityNode = {
        ...activity,
        progress: event.payload.progress ?? activity.progress,
        message: event.payload.message ?? activity.message,
      };

      const newActivities = new Map(state.activities);
      newActivities.set(event.id, updatedActivity);

      return { ...state, activities: newActivities };
    }

    case 'activity:success': {
      const activity = state.activities.get(event.id);
      if (!activity) return state;

      const updatedActivity: ActivityNode = {
        ...activity,
        status: 'success',
      };

      const newActivities = new Map(state.activities);
      newActivities.set(event.id, updatedActivity);

      return { ...state, activities: newActivities };
    }

    case 'activity:failure': {
      const activity = state.activities.get(event.id);
      if (!activity) return state;

      const errorMessage = event.error instanceof Error ? event.error.message : String(event.error);

      const updatedActivity: ActivityNode = {
        ...activity,
        status: 'failure',
        message: errorMessage,
      };

      const newActivities = new Map(state.activities);
      newActivities.set(event.id, updatedActivity);

      return { ...state, activities: newActivities };
    }

    case 'log': {
      if (!event.activityId) return state;

      const activity = state.activities.get(event.activityId);
      if (!activity) return state;

      const updatedActivity: ActivityNode = {
        ...activity,
        logs: [...activity.logs, { level: event.level, message: event.message }],
      };

      const newActivities = new Map(state.activities);
      newActivities.set(event.activityId, updatedActivity);

      return { ...state, activities: newActivities };
    }

    default:
      return state;
  }
}

/**
 * Get activities that belong to a tabs group
 */
export function getTabsGroupActivities(state: EventDrivenState, groupId: GroupId): ActivityNode[] {
  const group = state.groups.get(groupId);
  if (!group || group.layout !== 'tabs') return [];

  return group.children
    .map((childId) => state.activities.get(childId as ActivityId))
    .filter((activity): activity is ActivityNode => activity !== undefined);
}

/**
 * Find the first tabs group in the state
 */
export function findTabsGroup(state: EventDrivenState): GroupNode | undefined {
  for (const group of state.groups.values()) {
    if (group.layout === 'tabs') {
      return group;
    }
  }
  return undefined;
}
