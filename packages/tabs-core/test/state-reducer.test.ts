import { describe, it, expect } from 'bun:test';
import { createInitialState, reducer, getTabsGroupActivities, findTabsGroup } from '../src';
import type { CLIEvent, ActivityId, GroupId } from '@pokit/core';

// =============================================================================
// Helper to create test IDs
// =============================================================================

function activityId(id: string): ActivityId {
  return `activity-${id}` as ActivityId;
}

function groupId(id: string): GroupId {
  return `group-${id}` as GroupId;
}

// =============================================================================
// createInitialState Tests
// =============================================================================

describe('createInitialState', () => {
  it('returns correct initial structure', () => {
    const state = createInitialState();

    expect(state.appName).toBeUndefined();
    expect(state.version).toBeUndefined();
    expect(state.exitCode).toBeUndefined();
    expect(state.activities).toBeInstanceOf(Map);
    expect(state.activities.size).toBe(0);
    expect(state.groups).toBeInstanceOf(Map);
    expect(state.groups.size).toBe(0);
    expect(state.rootChildren).toEqual([]);
  });
});

// =============================================================================
// reducer Tests - Root Events
// =============================================================================

describe('reducer - root events', () => {
  it('handles root:start event', () => {
    const state = createInitialState();
    const event: CLIEvent = {
      type: 'root:start',
      appName: 'test-cli',
      version: '1.0.0',
    };

    const newState = reducer(state, event);

    expect(newState.appName).toBe('test-cli');
    expect(newState.version).toBe('1.0.0');
  });

  it('handles root:end event', () => {
    const state = createInitialState();
    const event: CLIEvent = {
      type: 'root:end',
      exitCode: 0,
    };

    const newState = reducer(state, event);

    expect(newState.exitCode).toBe(0);
  });

  it('handles root:end with non-zero exit code', () => {
    const state = createInitialState();
    const event: CLIEvent = {
      type: 'root:end',
      exitCode: 1,
    };

    const newState = reducer(state, event);

    expect(newState.exitCode).toBe(1);
  });
});

// =============================================================================
// reducer Tests - Group Events
// =============================================================================

describe('reducer - group events', () => {
  it('handles group:start at root level', () => {
    const state = createInitialState();
    const id = groupId('1');
    const event: CLIEvent = {
      type: 'group:start',
      id,
      label: 'Test Group',
      layout: 'sequence',
    };

    const newState = reducer(state, event);

    expect(newState.groups.has(id)).toBe(true);
    expect(newState.groups.get(id)).toEqual({
      type: 'group',
      id,
      parentId: undefined,
      label: 'Test Group',
      layout: 'sequence',
      children: [],
    });
    expect(newState.rootChildren).toContain(id);
  });

  it('handles group:start with parent', () => {
    // First add parent group
    let state = createInitialState();
    const parentId = groupId('parent');
    const childId = groupId('child');

    state = reducer(state, {
      type: 'group:start',
      id: parentId,
      label: 'Parent',
      layout: 'sequence',
    });

    // Then add child group
    state = reducer(state, {
      type: 'group:start',
      id: childId,
      parentId,
      label: 'Child',
      layout: 'parallel',
    });

    expect(state.groups.get(childId)?.parentId).toBe(parentId);
    expect(state.groups.get(parentId)?.children).toContain(childId);
    expect(state.rootChildren).not.toContain(childId);
  });

  it('handles group:start with tabs layout', () => {
    const state = createInitialState();
    const id = groupId('tabs');
    const event: CLIEvent = {
      type: 'group:start',
      id,
      label: 'Tabs Group',
      layout: 'tabs',
    };

    const newState = reducer(state, event);

    expect(newState.groups.get(id)?.layout).toBe('tabs');
  });

  it('handles group:end (returns state unchanged)', () => {
    let state = createInitialState();
    const id = groupId('1');

    state = reducer(state, {
      type: 'group:start',
      id,
      label: 'Test',
      layout: 'sequence',
    });

    const newState = reducer(state, {
      type: 'group:end',
      id,
    });

    // State should be unchanged
    expect(newState.groups.has(id)).toBe(true);
  });
});

// =============================================================================
// reducer Tests - Activity Events
// =============================================================================

describe('reducer - activity events', () => {
  it('handles activity:start at root level', () => {
    const state = createInitialState();
    const id = activityId('1');
    const event: CLIEvent = {
      type: 'activity:start',
      id,
      label: 'Running task',
    };

    const newState = reducer(state, event);

    expect(newState.activities.has(id)).toBe(true);
    expect(newState.activities.get(id)).toEqual({
      type: 'activity',
      id,
      parentId: undefined,
      label: 'Running task',
      status: 'running',
      meta: undefined,
      logs: [],
    });
    expect(newState.rootChildren).toContain(id);
  });

  it('handles activity:start in group', () => {
    let state = createInitialState();
    const gId = groupId('g1');
    const aId = activityId('a1');

    state = reducer(state, {
      type: 'group:start',
      id: gId,
      label: 'Group',
      layout: 'sequence',
    });

    state = reducer(state, {
      type: 'activity:start',
      id: aId,
      parentId: gId,
      label: 'Activity',
    });

    expect(state.activities.get(aId)?.parentId).toBe(gId);
    expect(state.groups.get(gId)?.children).toContain(aId);
  });

  it('handles activity:start with meta', () => {
    const state = createInitialState();
    const id = activityId('1');
    const event: CLIEvent = {
      type: 'activity:start',
      id,
      label: 'Task with meta',
      meta: { command: 'npm test', cwd: '/app' },
    };

    const newState = reducer(state, event);

    expect(newState.activities.get(id)?.meta).toEqual({
      command: 'npm test',
      cwd: '/app',
    });
  });

  it('handles activity:update with progress', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Downloading',
    });

    state = reducer(state, {
      type: 'activity:update',
      id,
      payload: { progress: 50 },
    });

    expect(state.activities.get(id)?.progress).toBe(50);
  });

  it('handles activity:update with message', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Processing',
    });

    state = reducer(state, {
      type: 'activity:update',
      id,
      payload: { message: 'Step 2 of 5' },
    });

    expect(state.activities.get(id)?.message).toBe('Step 2 of 5');
  });

  it('handles activity:update with both progress and message', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Installing',
    });

    state = reducer(state, {
      type: 'activity:update',
      id,
      payload: { progress: 75, message: 'Installing dependencies...' },
    });

    const activity = state.activities.get(id);
    expect(activity?.progress).toBe(75);
    expect(activity?.message).toBe('Installing dependencies...');
  });

  it('handles activity:update for non-existent activity', () => {
    const state = createInitialState();
    const newState = reducer(state, {
      type: 'activity:update',
      id: activityId('nonexistent'),
      payload: { progress: 50 },
    });

    // Should return same state
    expect(newState).toBe(state);
  });

  it('handles activity:success', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Task',
    });

    state = reducer(state, {
      type: 'activity:success',
      id,
    });

    expect(state.activities.get(id)?.status).toBe('success');
  });

  it('handles activity:failure with Error', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Task',
    });

    state = reducer(state, {
      type: 'activity:failure',
      id,
      error: new Error('Something went wrong'),
    });

    const activity = state.activities.get(id);
    expect(activity?.status).toBe('failure');
    expect(activity?.message).toBe('Something went wrong');
  });

  it('handles activity:failure with string error', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Task',
    });

    state = reducer(state, {
      type: 'activity:failure',
      id,
      error: 'Plain string error',
    });

    expect(state.activities.get(id)?.message).toBe('Plain string error');
  });
});

// =============================================================================
// reducer Tests - Log Events
// =============================================================================

describe('reducer - log events', () => {
  it('handles log event with activityId', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Task',
    });

    state = reducer(state, {
      type: 'log',
      level: 'info',
      message: 'Processing file...',
      activityId: id,
    });

    const activity = state.activities.get(id);
    expect(activity?.logs).toHaveLength(1);
    expect(activity?.logs[0]).toEqual({
      level: 'info',
      message: 'Processing file...',
    });
  });

  it('handles multiple log events', () => {
    let state = createInitialState();
    const id = activityId('1');

    state = reducer(state, {
      type: 'activity:start',
      id,
      label: 'Task',
    });

    state = reducer(state, {
      type: 'log',
      level: 'info',
      message: 'Step 1',
      activityId: id,
    });

    state = reducer(state, {
      type: 'log',
      level: 'warn',
      message: 'Warning!',
      activityId: id,
    });

    state = reducer(state, {
      type: 'log',
      level: 'error',
      message: 'Error occurred',
      activityId: id,
    });

    expect(state.activities.get(id)?.logs).toHaveLength(3);
  });

  it('ignores log event without activityId', () => {
    const state = createInitialState();
    const newState = reducer(state, {
      type: 'log',
      level: 'info',
      message: 'Orphan log',
    });

    expect(newState).toBe(state);
  });

  it('ignores log event for non-existent activity', () => {
    const state = createInitialState();
    const newState = reducer(state, {
      type: 'log',
      level: 'info',
      message: 'Log for missing activity',
      activityId: activityId('nonexistent'),
    });

    expect(newState).toBe(state);
  });
});

// =============================================================================
// reducer Tests - Unknown Events
// =============================================================================

describe('reducer - unknown events', () => {
  it('returns state unchanged for unknown event type', () => {
    const state = createInitialState();
    const newState = reducer(state, { type: 'unknown:event' } as any);

    expect(newState).toBe(state);
  });
});

// =============================================================================
// getTabsGroupActivities Tests
// =============================================================================

describe('getTabsGroupActivities', () => {
  it('returns activities in tabs group', () => {
    let state = createInitialState();
    const gId = groupId('tabs');
    const a1 = activityId('1');
    const a2 = activityId('2');

    state = reducer(state, {
      type: 'group:start',
      id: gId,
      label: 'Tabs',
      layout: 'tabs',
    });

    state = reducer(state, {
      type: 'activity:start',
      id: a1,
      parentId: gId,
      label: 'Activity 1',
    });

    state = reducer(state, {
      type: 'activity:start',
      id: a2,
      parentId: gId,
      label: 'Activity 2',
    });

    const activities = getTabsGroupActivities(state, gId);

    expect(activities).toHaveLength(2);
    expect(activities.map((a) => a.label)).toContain('Activity 1');
    expect(activities.map((a) => a.label)).toContain('Activity 2');
  });

  it('returns empty array for non-tabs group', () => {
    let state = createInitialState();
    const gId = groupId('seq');

    state = reducer(state, {
      type: 'group:start',
      id: gId,
      label: 'Sequential',
      layout: 'sequence',
    });

    const activities = getTabsGroupActivities(state, gId);

    expect(activities).toEqual([]);
  });

  it('returns empty array for non-existent group', () => {
    const state = createInitialState();
    const activities = getTabsGroupActivities(state, groupId('nonexistent'));

    expect(activities).toEqual([]);
  });
});

// =============================================================================
// findTabsGroup Tests
// =============================================================================

describe('findTabsGroup', () => {
  it('finds tabs group in state', () => {
    let state = createInitialState();

    state = reducer(state, {
      type: 'group:start',
      id: groupId('seq'),
      label: 'Sequential',
      layout: 'sequence',
    });

    state = reducer(state, {
      type: 'group:start',
      id: groupId('tabs'),
      label: 'Tabs',
      layout: 'tabs',
    });

    const tabsGroup = findTabsGroup(state);

    expect(tabsGroup).toBeDefined();
    expect(tabsGroup?.layout).toBe('tabs');
    expect(tabsGroup?.label).toBe('Tabs');
  });

  it('returns first tabs group if multiple exist', () => {
    let state = createInitialState();

    state = reducer(state, {
      type: 'group:start',
      id: groupId('tabs1'),
      label: 'First Tabs',
      layout: 'tabs',
    });

    state = reducer(state, {
      type: 'group:start',
      id: groupId('tabs2'),
      label: 'Second Tabs',
      layout: 'tabs',
    });

    const tabsGroup = findTabsGroup(state);

    // Should return first one encountered
    expect(tabsGroup).toBeDefined();
    expect(tabsGroup?.label).toBe('First Tabs');
  });

  it('returns undefined when no tabs group exists', () => {
    let state = createInitialState();

    state = reducer(state, {
      type: 'group:start',
      id: groupId('seq'),
      label: 'Sequential',
      layout: 'sequence',
    });

    const tabsGroup = findTabsGroup(state);

    expect(tabsGroup).toBeUndefined();
  });

  it('returns undefined for empty state', () => {
    const state = createInitialState();
    const tabsGroup = findTabsGroup(state);

    expect(tabsGroup).toBeUndefined();
  });
});
