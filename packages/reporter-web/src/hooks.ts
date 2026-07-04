/**
 * Reporter Web React Hooks
 *
 * React hooks for subscribing to reporter state using useSyncExternalStore.
 * Provides full state subscription and selective subscriptions for individual
 * activities and groups.
 */

import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { ActivityId, GroupId } from '@pokit/core';
import type { ReporterStore, ReporterState, ActivityState, GroupState } from './types';

/**
 * Subscribe to the full reporter state
 *
 * @param store - The reporter store
 * @returns Current reporter state
 *
 * @example
 * ```tsx
 * const state = useReporterState(store);
 * return <div>Status: {state.root.status}</div>;
 * ```
 */
export function useReporterState(store: ReporterStore): ReporterState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/**
 * Subscribe to a single activity by ID
 * Returns undefined if activity doesn't exist
 *
 * @param store - The reporter store
 * @param id - Activity ID to subscribe to
 * @returns Activity state or undefined
 *
 * @example
 * ```tsx
 * const activity = useActivity(store, 'task-1');
 * if (!activity) return null;
 * return <div>{activity.label}: {activity.status}</div>;
 * ```
 */
export function useActivity(store: ReporterStore, id: ActivityId): ActivityState | undefined {
  // Track the previous activity reference for shallow comparison
  const prevActivityRef = useRef<ActivityState | undefined>(undefined);

  const getSnapshot = useCallback(() => {
    const state = store.getSnapshot();
    const activity = state.activities.get(id);

    // Return same reference if activity hasn't changed (shallow comparison)
    if (prevActivityRef.current === activity) {
      return prevActivityRef.current;
    }

    // Check if activity content is the same (for Map recreation scenarios)
    if (
      prevActivityRef.current &&
      activity &&
      prevActivityRef.current.id === activity.id &&
      prevActivityRef.current.status === activity.status &&
      prevActivityRef.current.progress === activity.progress &&
      prevActivityRef.current.message === activity.message &&
      prevActivityRef.current.justStarted === activity.justStarted &&
      prevActivityRef.current.justCompleted === activity.justCompleted &&
      prevActivityRef.current.justFailed === activity.justFailed &&
      prevActivityRef.current.completedAt === activity.completedAt
    ) {
      return prevActivityRef.current;
    }

    prevActivityRef.current = activity;
    return activity;
  }, [store, id]);

  const getServerSnapshot = useCallback(() => {
    return store.getServerSnapshot().activities.get(id);
  }, [store, id]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to a single group by ID
 * Returns undefined if group doesn't exist
 *
 * @param store - The reporter store
 * @param id - Group ID to subscribe to
 * @returns Group state or undefined
 *
 * @example
 * ```tsx
 * const group = useGroup(store, 'checks');
 * if (!group) return null;
 * return <div>{group.label} ({group.activityIds.length} tasks)</div>;
 * ```
 */
export function useGroup(store: ReporterStore, id: GroupId): GroupState | undefined {
  // Track the previous group reference for shallow comparison
  const prevGroupRef = useRef<GroupState | undefined>(undefined);

  const getSnapshot = useCallback(() => {
    const state = store.getSnapshot();
    const group = state.groups.get(id);

    // Return same reference if group hasn't changed
    if (prevGroupRef.current === group) {
      return prevGroupRef.current;
    }

    // Check if group content is the same (for Map recreation scenarios)
    if (
      prevGroupRef.current &&
      group &&
      prevGroupRef.current.id === group.id &&
      prevGroupRef.current.label === group.label &&
      prevGroupRef.current.hasFailure === group.hasFailure &&
      prevGroupRef.current.justStartedGroup === group.justStartedGroup &&
      prevGroupRef.current.justEnded === group.justEnded &&
      prevGroupRef.current.endedAt === group.endedAt &&
      prevGroupRef.current.activityIds.length === group.activityIds.length &&
      prevGroupRef.current.childGroupIds.length === group.childGroupIds.length
    ) {
      return prevGroupRef.current;
    }

    prevGroupRef.current = group;
    return group;
  }, [store, id]);

  const getServerSnapshot = useCallback(() => {
    return store.getServerSnapshot().groups.get(id);
  }, [store, id]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to root state only
 * More efficient than useReporterState when you only need root info
 *
 * @param store - The reporter store
 * @returns Root state
 *
 * @example
 * ```tsx
 * const root = useRootState(store);
 * return <div>App: {root.appName} - {root.status}</div>;
 * ```
 */
export function useRootState(store: ReporterStore): ReporterState['root'] {
  const prevRootRef = useRef<ReporterState['root'] | undefined>(undefined);

  const getSnapshot = useCallback(() => {
    const state = store.getSnapshot();
    const root = state.root;

    // Return same reference if root hasn't changed
    if (
      prevRootRef.current &&
      prevRootRef.current.status === root.status &&
      prevRootRef.current.appName === root.appName &&
      prevRootRef.current.exitCode === root.exitCode
    ) {
      return prevRootRef.current;
    }

    prevRootRef.current = root;
    return root;
  }, [store]);

  const getServerSnapshot = useCallback(() => {
    return store.getServerSnapshot().root;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to logs
 * Returns the full log array
 *
 * @param store - The reporter store
 * @returns Array of log entries
 *
 * @example
 * ```tsx
 * const logs = useLogs(store);
 * return (
 *   <ul>
 *     {logs.map(log => <li key={log.id}>{log.message}</li>)}
 *   </ul>
 * );
 * ```
 */
export function useLogs(store: ReporterStore): ReporterState['logs'] {
  const prevLogsRef = useRef<ReporterState['logs'] | undefined>(undefined);

  const getSnapshot = useCallback(() => {
    const state = store.getSnapshot();
    const logs = state.logs;

    // Return same reference if logs haven't changed
    if (prevLogsRef.current && prevLogsRef.current.length === logs.length) {
      // Quick check - if lengths match and last item is same, assume unchanged
      if (
        logs.length === 0 ||
        prevLogsRef.current[logs.length - 1]?.id === logs[logs.length - 1]?.id
      ) {
        return prevLogsRef.current;
      }
    }

    prevLogsRef.current = logs;
    return logs;
  }, [store]);

  const getServerSnapshot = useCallback(() => {
    return store.getServerSnapshot().logs;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to suspended state
 *
 * @param store - The reporter store
 * @returns Whether reporter is suspended
 */
export function useSuspended(store: ReporterStore): boolean {
  const getSnapshot = useCallback(() => {
    return store.getSnapshot().suspended;
  }, [store]);

  const getServerSnapshot = useCallback(() => {
    return store.getServerSnapshot().suspended;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
