import { describe, it, expect } from 'bun:test';
import {
  captureEvents,
  normalizeEvents,
  eventTypes,
  filterEvents,
  stripRootLifecycleEvents,
} from './utils';
import * as fixtures from './fixtures';

describe('Reporter', () => {
  describe('groups and activities', () => {
    it('emits group and activity events', async () => {
      const { events } = await captureEvents(['with-reporter']);
      expect(normalizeEvents(stripRootLifecycleEvents(events))).toEqual(fixtures.taskWithReporter.events);
    });

    it('wraps activities in group', async () => {
      const { events } = await captureEvents(['with-reporter']);
      const types = eventTypes(stripRootLifecycleEvents(events));

      expect(types[0]).toBe('group:start');
      expect(types.includes('activity:start')).toBe(true);
      expect(types.includes('activity:success')).toBe(true);
    });

    it('links activities to parent group', async () => {
      const { events } = await captureEvents(['with-reporter']);
      const normalized = normalizeEvents(stripRootLifecycleEvents(events));

      const groupStart = normalized.find((e) => e.type === 'group:start');
      const activities = normalized.filter((e) => e.type === 'activity:start');

      if (groupStart?.type === 'group:start') {
        for (const activity of activities) {
          if (activity.type === 'activity:start') {
            expect(activity.parentId).toBe(groupStart.id);
          }
        }
      }
    });
  });

  describe('log levels', () => {
    it('emits info log events', async () => {
      const { events } = await captureEvents(['with-reporter']);
      const infoLogs = events.filter((e) => e.type === 'log' && e.level === 'info');
      expect(infoLogs.length).toBeGreaterThan(0);
    });

    it('emits success log events', async () => {
      const { events } = await captureEvents(['with-reporter']);
      const successLogs = events.filter((e) => e.type === 'log' && e.level === 'success');
      expect(successLogs.length).toBeGreaterThan(0);
    });

    it('emits all log levels from task', async () => {
      const { events } = await captureEvents(['with-log-levels']);
      const logEvents = events.filter((e) => e.type === 'log');

      const levels = logEvents.map((e) => (e.type === 'log' ? e.level : null));
      expect(levels).toContain('info');
      expect(levels).toContain('success');
      expect(levels).toContain('warn');
    });
  });

  describe('nested groups', () => {
    it('supports nested group structure', async () => {
      const { events, error } = await captureEvents(['with-nested-groups']);
      expect(error).toBeUndefined();

      const groupStarts = events.filter((e) => e.type === 'group:start');
      const groupEnds = events.filter((e) => e.type === 'group:end');

      expect(groupStarts).toHaveLength(2);
      expect(groupEnds).toHaveLength(2);
    });

    it('maintains correct group hierarchy', async () => {
      const { events } = await captureEvents(['with-nested-groups']);
      const normalized = normalizeEvents(stripRootLifecycleEvents(events));
      const types = eventTypes(normalized);

      const firstGroupStart = types.indexOf('group:start');
      const secondGroupStart = types.indexOf('group:start', firstGroupStart + 1);

      expect(firstGroupStart).toBeLessThan(secondGroupStart);
    });

    it('closes groups in correct order', async () => {
      const { events } = await captureEvents(['with-nested-groups']);
      const types = eventTypes(stripRootLifecycleEvents(events));

      const groupEnds: number[] = [];
      types.forEach((t, i) => {
        if (t === 'group:end') groupEnds.push(i);
      });

      expect(groupEnds).toHaveLength(2);
      expect(groupEnds[0]).toBeLessThan(groupEnds[1]);
    });
  });

  describe('activity states', () => {
    it('emits start and success for passing activity', async () => {
      const { events } = await captureEvents(['with-reporter']);
      const activities = filterEvents(events, ['activity:start', 'activity:success']);

      const starts = activities.filter((e) => e.type === 'activity:start');
      const successes = activities.filter((e) => e.type === 'activity:success');

      expect(starts.length).toBe(successes.length);
    });
  });
});
