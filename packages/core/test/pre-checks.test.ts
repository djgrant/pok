import { describe, it, expect } from 'bun:test';
import { captureEvents, normalizeEvents, eventTypes } from './utils';
import * as fixtures from './fixtures';

describe('Pre-flight Checks', () => {
  describe('static checks', () => {
    it('emits group with activity events for each check', async () => {
      const { events } = await captureEvents(['with-pre']);
      expect(normalizeEvents(events)).toEqual(fixtures.commandWithPre.events);
    });

    it('runs checks in order', async () => {
      const { events } = await captureEvents(['with-pre']);
      const types = eventTypes(events);
      expect(types).toEqual([
        'group:start',
        'activity:start',
        'activity:success',
        'activity:start',
        'activity:success',
        'group:end',
      ]);
    });

    it('uses "Pre-flight Checks" as group label', async () => {
      const { events } = await captureEvents(['with-pre']);
      const groupStart = events.find((e) => e.type === 'group:start');
      expect(groupStart).toBeDefined();
      if (groupStart?.type === 'group:start') {
        expect(groupStart.label).toBe('Pre-flight Checks');
      }
    });
  });

  describe('dynamic checks', () => {
    it('runs fewer checks in dev environment', async () => {
      const { events } = await captureEvents(['with-dynamic-pre', '--env', 'dev']);
      expect(normalizeEvents(events)).toEqual(fixtures.commandWithDynamicPreDev.events);
    });

    it('runs more checks in staging environment', async () => {
      const { events } = await captureEvents(['with-dynamic-pre', '--env', 'staging']);
      expect(normalizeEvents(events)).toEqual(fixtures.commandWithDynamicPreStaging.events);
    });

    it('selects checks based on context', async () => {
      const { events: devEvents } = await captureEvents(['with-dynamic-pre', '--env', 'dev']);
      const { events: stagingEvents } = await captureEvents([
        'with-dynamic-pre',
        '--env',
        'staging',
      ]);

      const devActivities = devEvents.filter((e) => e.type.startsWith('activity:'));
      const stagingActivities = stagingEvents.filter((e) => e.type.startsWith('activity:'));

      expect(stagingActivities.length).toBeGreaterThan(devActivities.length);
    });
  });

  describe('failing checks', () => {
    it('throws error when check fails', async () => {
      const { error } = await captureEvents(['with-failing-pre']);
      expect(error).toBeDefined();
      expect(error?.message).toContain('This check always fails');
    });

    it('emits activity:failure for failing check', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const failureEvent = events.find((e) => e.type === 'activity:failure');
      expect(failureEvent).toBeDefined();
    });

    it('stops after first failing check', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const successEvents = events.filter((e) => e.type === 'activity:success');
      const failureEvents = events.filter((e) => e.type === 'activity:failure');

      expect(successEvents).toHaveLength(1);
      expect(failureEvents).toHaveLength(1);
    });
  });

  describe('check remediation', () => {
    it('includes remediation in failure event', async () => {
      const { events } = await captureEvents(['with-failing-pre-remediation']);
      const failureEvent = events.find((e) => e.type === 'activity:failure');

      expect(failureEvent).toBeDefined();
      if (failureEvent?.type === 'activity:failure') {
        expect(failureEvent.remediation).toEqual([
          'Start Docker Desktop, or',
          "Run 'sudo systemctl start docker' (Linux)",
        ]);
      }
    });

    it('includes documentationUrl in failure event', async () => {
      const { events } = await captureEvents(['with-failing-pre-remediation']);
      const failureEvent = events.find((e) => e.type === 'activity:failure');

      expect(failureEvent).toBeDefined();
      if (failureEvent?.type === 'activity:failure') {
        expect(failureEvent.documentationUrl).toBe('https://docs.docker.com/get-started/');
      }
    });

    it('uses custom errorMessage instead of thrown error message', async () => {
      const { events } = await captureEvents(['with-failing-pre-remediation']);
      const failureEvent = events.find((e) => e.type === 'activity:failure');

      expect(failureEvent).toBeDefined();
      if (failureEvent?.type === 'activity:failure') {
        // Should use the custom errorMessage, not the thrown error message
        const errorMessage =
          failureEvent.error instanceof Error
            ? failureEvent.error.message
            : String(failureEvent.error);
        expect(errorMessage).toBe('Docker daemon is not running');
      }
    });

    it('matches expected events for check with remediation', async () => {
      const { events } = await captureEvents(['with-failing-pre-remediation']);
      expect(normalizeEvents(events)).toEqual(fixtures.commandWithFailingPreRemediation.events);
    });
  });
});
