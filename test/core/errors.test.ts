import { describe, it, expect } from 'bun:test';
import { captureEvents, eventTypes } from './utils';

describe('Error Handling', () => {
  describe('pre-flight check errors', () => {
    it('throws error when check fails', async () => {
      const { error } = await captureEvents(['with-failing-pre']);
      expect(error).toBeDefined();
    });

    it('includes error message in thrown error', async () => {
      const { error } = await captureEvents(['with-failing-pre']);
      expect(error?.message).toContain('This check always fails');
    });

    it('emits activity:failure event', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const types = eventTypes(events);
      expect(types).toContain('activity:failure');
    });

    it('still emits group:end after error', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const types = eventTypes(events);
      expect(types).toContain('group:end');
    });

    it('successful checks run before failing check', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const types = eventTypes(events);

      const successIndex = types.indexOf('activity:success');
      const failureIndex = types.indexOf('activity:failure');

      expect(successIndex).toBeGreaterThan(-1);
      expect(failureIndex).toBeGreaterThan(successIndex);
    });
  });

  describe('activity errors', () => {
    it('throws error when activity fails', async () => {
      const { error } = await captureEvents(['with-activity-failure']);
      expect(error).toBeDefined();
    });

    it('includes error message from failed activity', async () => {
      const { error } = await captureEvents(['with-activity-failure']);
      expect(error?.message).toContain('Activity failed intentionally');
    });

    it('emits activity:failure for failing activity', async () => {
      const { events } = await captureEvents(['with-activity-failure']);
      const types = eventTypes(events);
      expect(types).toContain('activity:failure');
    });

    it('completes successful activities before failure', async () => {
      const { events } = await captureEvents(['with-activity-failure']);
      const types = eventTypes(events);

      const successCount = types.filter((t) => t === 'activity:success').length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('does not run activities after failure', async () => {
      const { events } = await captureEvents(['with-activity-failure']);

      const activityStarts = events.filter((e) => e.type === 'activity:start');
      const labels = activityStarts.map((e) =>
        e.type === 'activity:start' ? e.label : ''
      );

      expect(labels).toContain('Succeeds');
      expect(labels).toContain('Fails');
      expect(labels).not.toContain('Never runs');
    });
  });

  describe('error event structure', () => {
    it('activity:failure includes error details', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const failureEvent = events.find((e) => e.type === 'activity:failure');

      expect(failureEvent).toBeDefined();
      if (failureEvent?.type === 'activity:failure') {
        expect(failureEvent.error).toBeDefined();
      }
    });
  });
});
