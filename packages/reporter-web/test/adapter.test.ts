import { describe, it, expect, beforeEach } from 'bun:test';
import { createEventBus, type EventBus, type CLIEvent } from '@pokit/core';
import { createReporterStore, createWebReporterAdapter } from '../src';
import type { ReporterStoreWithHandler } from '../src/store';

describe('createWebReporterAdapter', () => {
  let store: ReporterStoreWithHandler;
  let bus: EventBus;

  beforeEach(() => {
    store = createReporterStore({ disableTemporalMarkerClearing: true });
    bus = createEventBus();
  });

  describe('start', () => {
    it('subscribes to event bus and handles events', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      bus.emit({ type: 'root:start', appName: 'test-app' });

      const state = store.getState();
      expect(state.root.status).toBe('running');
      expect(state.root.appName).toBe('test-app');

      controller.stop();
    });

    it('handles multiple events in sequence', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      const events: CLIEvent[] = [
        { type: 'root:start', appName: 'test-app' },
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
        { type: 'root:end', exitCode: 0 },
      ];

      for (const event of events) {
        bus.emit(event);
      }

      const state = store.getState();
      expect(state.root.status).toBe('complete');
      expect(state.groups.get('g1')!.endedAt).toBeDefined();
      expect(state.activities.get('a1')!.status).toBe('success');

      controller.stop();
    });
  });

  describe('stop', () => {
    it('unsubscribes from event bus', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      bus.emit({ type: 'root:start', appName: 'test-app' });
      expect(store.getState().root.status).toBe('running');

      controller.stop();

      // Events after stop should not be processed
      bus.emit({ type: 'root:end', exitCode: 1 });
      expect(store.getState().root.status).toBe('running'); // Should not change
    });

    it('is idempotent - can be called multiple times', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      // Should not throw when called multiple times
      expect(() => {
        controller.stop();
        controller.stop();
        controller.stop();
      }).not.toThrow();
    });
  });

  describe('full event workflow', () => {
    it('handles parallel group with mixed results', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Checks', layout: 'parallel' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Lint' },
        { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Types' },
        { type: 'activity:start', id: 'a3', parentId: 'g1', label: 'Tests' },
        { type: 'activity:success', id: 'a1' },
        { type: 'activity:failure', id: 'a2', error: 'Type errors found' },
        { type: 'activity:success', id: 'a3' },
        { type: 'group:end', id: 'g1' },
      ];

      for (const event of events) {
        bus.emit(event);
      }

      const state = store.getState();
      const group = state.groups.get('g1')!;

      expect(group.activityIds).toEqual(['a1', 'a2', 'a3']);
      expect(group.hasFailure).toBe(true);

      expect(state.activities.get('a1')!.status).toBe('success');
      expect(state.activities.get('a2')!.status).toBe('failure');
      expect(state.activities.get('a2')!.error!.message).toBe('Type errors found');
      expect(state.activities.get('a3')!.status).toBe('success');

      controller.stop();
    });

    it('handles activity updates with progress', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      const events: CLIEvent[] = [
        { type: 'activity:start', id: 'a1', label: 'Download' },
        { type: 'activity:update', id: 'a1', payload: { progress: 25, message: 'Downloading...' } },
        { type: 'activity:update', id: 'a1', payload: { progress: 50 } },
        { type: 'activity:update', id: 'a1', payload: { progress: 100, message: 'Complete' } },
        { type: 'activity:success', id: 'a1' },
      ];

      for (const event of events) {
        bus.emit(event);
      }

      const activity = store.getState().activities.get('a1')!;
      expect(activity.progress).toBe(100);
      expect(activity.message).toBe('Complete');
      expect(activity.status).toBe('success');

      controller.stop();
    });

    it('handles logs associated with activities', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      const events: CLIEvent[] = [
        { type: 'activity:start', id: 'a1', label: 'Build' },
        { type: 'log', activityId: 'a1', level: 'info', message: 'Starting build...' },
        { type: 'log', activityId: 'a1', level: 'warn', message: 'Deprecated API used' },
        { type: 'activity:success', id: 'a1' },
        { type: 'log', level: 'success', message: 'Build complete!' },
      ];

      for (const event of events) {
        bus.emit(event);
      }

      const state = store.getState();
      expect(state.logs.length).toBe(3);
      expect(state.logs[0]!.activityId).toBe('a1');
      expect(state.logs[1]!.activityId).toBe('a1');
      expect(state.logs[2]!.activityId).toBeUndefined();

      controller.stop();
    });

    it('handles suspend and resume', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      bus.emit({ type: 'reporter:suspend' });
      expect(store.getState().suspended).toBe(true);

      bus.emit({ type: 'reporter:resume' });
      expect(store.getState().suspended).toBe(false);

      controller.stop();
    });

    it('handles nested groups', () => {
      const adapter = createWebReporterAdapter(store);
      const controller = adapter.start(bus);

      const events: CLIEvent[] = [
        { type: 'group:start', id: 'parent', label: 'Parent', layout: 'sequence' },
        {
          type: 'group:start',
          id: 'child1',
          parentId: 'parent',
          label: 'Child 1',
          layout: 'parallel',
        },
        {
          type: 'group:start',
          id: 'child2',
          parentId: 'parent',
          label: 'Child 2',
          layout: 'sequence',
        },
        { type: 'group:end', id: 'child1' },
        { type: 'group:end', id: 'child2' },
        { type: 'group:end', id: 'parent' },
      ];

      for (const event of events) {
        bus.emit(event);
      }

      const state = store.getState();
      const parent = state.groups.get('parent')!;

      expect(parent.childGroupIds).toEqual(['child1', 'child2']);
      expect(state.groups.get('child1')!.parentId).toBe('parent');
      expect(state.groups.get('child2')!.parentId).toBe('parent');

      controller.stop();
    });
  });
});
