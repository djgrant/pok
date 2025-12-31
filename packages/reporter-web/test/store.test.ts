import { describe, it, expect, beforeEach } from 'bun:test';
import type { CLIEvent } from '@pokit/core';
import { createReporterStore, type ReporterStoreWithHandler } from '../src/store';

describe('createReporterStore', () => {
  let store: ReporterStoreWithHandler;

  beforeEach(() => {
    store = createReporterStore({ disableTemporalMarkerClearing: true });
  });

  describe('initial state', () => {
    it('starts with idle status', () => {
      const state = store.getState();
      expect(state.root.status).toBe('idle');
    });

    it('has empty collections', () => {
      const state = store.getState();
      expect(state.groups.size).toBe(0);
      expect(state.activities.size).toBe(0);
      expect(state.logs.length).toBe(0);
      expect(state.suspended).toBe(false);
    });
  });

  describe('root:start', () => {
    it('sets root to running with app info', () => {
      store._handleEvent({ type: 'root:start', appName: 'my-app', version: '1.0.0' });

      const state = store.getState();
      expect(state.root.status).toBe('running');
      expect(state.root.appName).toBe('my-app');
      expect(state.root.version).toBe('1.0.0');
      expect(state.root.startedAt).toBeDefined();
    });
  });

  describe('root:end', () => {
    it('sets root to complete on exit code 0', () => {
      store._handleEvent({ type: 'root:start', appName: 'my-app' });
      store._handleEvent({ type: 'root:end', exitCode: 0 });

      const state = store.getState();
      expect(state.root.status).toBe('complete');
      expect(state.root.exitCode).toBe(0);
      expect(state.root.endedAt).toBeDefined();
    });

    it('sets root to error on non-zero exit code', () => {
      store._handleEvent({ type: 'root:start', appName: 'my-app' });
      store._handleEvent({ type: 'root:end', exitCode: 1 });

      const state = store.getState();
      expect(state.root.status).toBe('error');
      expect(state.root.exitCode).toBe(1);
    });
  });

  describe('group:start', () => {
    it('creates a new group', () => {
      store._handleEvent({
        type: 'group:start',
        id: 'g1',
        label: 'Build',
        layout: 'sequence',
      });

      const state = store.getState();
      const group = state.groups.get('g1');
      expect(group).toBeDefined();
      expect(group!.id).toBe('g1');
      expect(group!.label).toBe('Build');
      expect(group!.layout).toBe('sequence');
      expect(group!.activityIds).toEqual([]);
      expect(group!.childGroupIds).toEqual([]);
      expect(group!.hasFailure).toBe(false);
      expect(group!.startedAt).toBeDefined();
      expect(group!.justStarted_group).toBe(true);
    });

    it('adds nested group to parent childGroupIds', () => {
      store._handleEvent({
        type: 'group:start',
        id: 'parent',
        label: 'Parent',
        layout: 'sequence',
      });
      store._handleEvent({
        type: 'group:start',
        id: 'child',
        parentId: 'parent',
        label: 'Child',
        layout: 'parallel',
      });

      const state = store.getState();
      const parent = state.groups.get('parent');
      expect(parent!.childGroupIds).toContain('child');
    });
  });

  describe('group:end', () => {
    it('marks group as ended', () => {
      store._handleEvent({
        type: 'group:start',
        id: 'g1',
        label: 'Build',
        layout: 'sequence',
      });
      store._handleEvent({ type: 'group:end', id: 'g1' });

      const state = store.getState();
      const group = state.groups.get('g1');
      expect(group!.endedAt).toBeDefined();
      expect(group!.justEnded).toBe(true);
    });
  });

  describe('activity:start', () => {
    it('creates a new activity with running status', () => {
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        label: 'Compile',
        meta: { framework: 'react' },
      });

      const state = store.getState();
      const activity = state.activities.get('a1');
      expect(activity).toBeDefined();
      expect(activity!.id).toBe('a1');
      expect(activity!.label).toBe('Compile');
      expect(activity!.status).toBe('running');
      expect(activity!.meta).toEqual({ framework: 'react' });
      expect(activity!.startedAt).toBeDefined();
      expect(activity!.justStarted).toBe(true);
    });

    it('adds activity to parent group activityIds', () => {
      store._handleEvent({
        type: 'group:start',
        id: 'g1',
        label: 'Build',
        layout: 'sequence',
      });
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        parentId: 'g1',
        label: 'Compile',
      });

      const state = store.getState();
      const group = state.groups.get('g1');
      expect(group!.activityIds).toContain('a1');
    });
  });

  describe('activity:update', () => {
    it('updates activity progress and message', () => {
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        label: 'Downloading',
      });
      store._handleEvent({
        type: 'activity:update',
        id: 'a1',
        payload: { progress: 50, message: 'Halfway there' },
      });

      const state = store.getState();
      const activity = state.activities.get('a1');
      expect(activity!.progress).toBe(50);
      expect(activity!.message).toBe('Halfway there');
    });

    it('accumulates custom payload data', () => {
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        label: 'Processing',
      });
      store._handleEvent({
        type: 'activity:update',
        id: 'a1',
        payload: { filesProcessed: 10 },
      });
      store._handleEvent({
        type: 'activity:update',
        id: 'a1',
        payload: { memoryUsed: '50mb' },
      });

      const state = store.getState();
      const activity = state.activities.get('a1');
      expect(activity!.payload).toEqual({
        filesProcessed: 10,
        memoryUsed: '50mb',
      });
    });
  });

  describe('activity:success', () => {
    it('marks activity as success', () => {
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        label: 'Task',
      });
      store._handleEvent({
        type: 'activity:success',
        id: 'a1',
      });

      const state = store.getState();
      const activity = state.activities.get('a1');
      expect(activity!.status).toBe('success');
      expect(activity!.completedAt).toBeDefined();
      expect(activity!.justCompleted).toBe(true);
    });
  });

  describe('activity:failure', () => {
    it('marks activity as failure with error info', () => {
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        label: 'Task',
      });
      store._handleEvent({
        type: 'activity:failure',
        id: 'a1',
        error: 'Something went wrong',
        remediation: ['Try again', 'Check logs'],
        documentationUrl: 'https://example.com/docs',
      });

      const state = store.getState();
      const activity = state.activities.get('a1');
      expect(activity!.status).toBe('failure');
      expect(activity!.completedAt).toBeDefined();
      expect(activity!.justFailed).toBe(true);
      expect(activity!.error).toEqual({
        message: 'Something went wrong',
        remediation: ['Try again', 'Check logs'],
        documentationUrl: 'https://example.com/docs',
      });
    });

    it('handles Error object in error field', () => {
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        label: 'Task',
      });
      store._handleEvent({
        type: 'activity:failure',
        id: 'a1',
        error: new Error('Error object message'),
      });

      const state = store.getState();
      const activity = state.activities.get('a1');
      expect(activity!.error!.message).toBe('Error object message');
    });

    it('marks parent group hasFailure', () => {
      store._handleEvent({
        type: 'group:start',
        id: 'g1',
        label: 'Build',
        layout: 'sequence',
      });
      store._handleEvent({
        type: 'activity:start',
        id: 'a1',
        parentId: 'g1',
        label: 'Task',
      });
      store._handleEvent({
        type: 'activity:failure',
        id: 'a1',
        error: 'Failed',
      });

      const state = store.getState();
      const group = state.groups.get('g1');
      expect(group!.hasFailure).toBe(true);
    });
  });

  describe('log', () => {
    it('adds log entry', () => {
      store._handleEvent({
        type: 'log',
        level: 'info',
        message: 'Hello world',
      });

      const state = store.getState();
      expect(state.logs.length).toBe(1);
      expect(state.logs[0]!.level).toBe('info');
      expect(state.logs[0]!.message).toBe('Hello world');
      expect(state.logs[0]!.timestamp).toBeDefined();
      expect(state.logs[0]!.id).toBeDefined();
    });

    it('preserves log order', () => {
      store._handleEvent({ type: 'log', level: 'info', message: 'First' });
      store._handleEvent({ type: 'log', level: 'warn', message: 'Second' });
      store._handleEvent({ type: 'log', level: 'error', message: 'Third' });

      const state = store.getState();
      expect(state.logs.length).toBe(3);
      expect(state.logs[0]!.message).toBe('First');
      expect(state.logs[1]!.message).toBe('Second');
      expect(state.logs[2]!.message).toBe('Third');
    });

    it('associates log with activity', () => {
      store._handleEvent({
        type: 'log',
        activityId: 'a1',
        level: 'info',
        message: 'Task log',
      });

      const state = store.getState();
      expect(state.logs[0]!.activityId).toBe('a1');
    });
  });

  describe('reporter:suspend and reporter:resume', () => {
    it('toggles suspended state', () => {
      store._handleEvent({ type: 'reporter:suspend' });
      expect(store.getState().suspended).toBe(true);

      store._handleEvent({ type: 'reporter:resume' });
      expect(store.getState().suspended).toBe(false);
    });
  });

  describe('subscription', () => {
    it('notifies listeners on state change', () => {
      let callCount = 0;
      store.subscribe(() => {
        callCount++;
      });

      store._handleEvent({ type: 'root:start', appName: 'test' });
      expect(callCount).toBe(1);

      store._handleEvent({ type: 'root:end', exitCode: 0 });
      expect(callCount).toBe(2);
    });

    it('unsubscribe stops notifications', () => {
      let callCount = 0;
      const unsubscribe = store.subscribe(() => {
        callCount++;
      });

      store._handleEvent({ type: 'root:start', appName: 'test' });
      expect(callCount).toBe(1);

      unsubscribe();
      store._handleEvent({ type: 'root:end', exitCode: 0 });
      expect(callCount).toBe(1);
    });
  });

  describe('getSnapshot and getServerSnapshot', () => {
    it('returns same reference as getState', () => {
      const state = store.getState();
      const snapshot = store.getSnapshot();
      const serverSnapshot = store.getServerSnapshot();

      expect(state).toBe(snapshot);
      expect(state).toBe(serverSnapshot);
    });
  });
});

describe('temporal marker clearing', () => {
  it('clears temporal markers after delay', async () => {
    const store = createReporterStore({ temporalMarkerDelay: 50 });

    store._handleEvent({
      type: 'activity:start',
      id: 'a1',
      label: 'Task',
    });

    // Initially has justStarted
    expect(store.getState().activities.get('a1')!.justStarted).toBe(true);

    // Wait for marker to clear
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Marker should be cleared
    expect(store.getState().activities.get('a1')!.justStarted).toBeUndefined();
  });

  it('clears group temporal markers after delay', async () => {
    const store = createReporterStore({ temporalMarkerDelay: 50 });

    store._handleEvent({
      type: 'group:start',
      id: 'g1',
      label: 'Build',
      layout: 'sequence',
    });

    // Initially has justStarted_group
    expect(store.getState().groups.get('g1')!.justStarted_group).toBe(true);

    // Wait for marker to clear
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Marker should be cleared
    expect(store.getState().groups.get('g1')!.justStarted_group).toBeUndefined();
  });

  it('clears justCompleted marker', async () => {
    const store = createReporterStore({ temporalMarkerDelay: 50 });

    store._handleEvent({
      type: 'activity:start',
      id: 'a1',
      label: 'Task',
    });
    store._handleEvent({
      type: 'activity:success',
      id: 'a1',
    });

    expect(store.getState().activities.get('a1')!.justCompleted).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(store.getState().activities.get('a1')!.justCompleted).toBeUndefined();
  });

  it('clears justFailed marker', async () => {
    const store = createReporterStore({ temporalMarkerDelay: 50 });

    store._handleEvent({
      type: 'activity:start',
      id: 'a1',
      label: 'Task',
    });
    store._handleEvent({
      type: 'activity:failure',
      id: 'a1',
      error: 'Failed',
    });

    expect(store.getState().activities.get('a1')!.justFailed).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(store.getState().activities.get('a1')!.justFailed).toBeUndefined();
  });

  it('clears justEnded marker on group', async () => {
    const store = createReporterStore({ temporalMarkerDelay: 50 });

    store._handleEvent({
      type: 'group:start',
      id: 'g1',
      label: 'Build',
      layout: 'sequence',
    });
    store._handleEvent({ type: 'group:end', id: 'g1' });

    expect(store.getState().groups.get('g1')!.justEnded).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(store.getState().groups.get('g1')!.justEnded).toBeUndefined();
  });
});
