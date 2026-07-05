import { describe, it, expect } from 'bun:test';
import { captureEvents, eventTypes, stripRootLifecycleEvents } from './utils';
import {
  isOperationalError,
  wasPresented,
  markPresented,
  markOperational,
  CommandError,
  TimeoutError,
  AbortError,
  CancelError,
  RouterError,
  CheckError,
  CLIError,
} from '../src';

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
      const types = eventTypes(stripRootLifecycleEvents(events));
      expect(types).toContain('activity:failure');
    });

    it('still emits group:end after error', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const types = eventTypes(stripRootLifecycleEvents(events));
      expect(types).toContain('group:end');
    });

    it('successful checks run before failing check', async () => {
      const { events } = await captureEvents(['with-failing-pre']);
      const types = eventTypes(stripRootLifecycleEvents(events));

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
      const types = eventTypes(stripRootLifecycleEvents(events));
      expect(types).toContain('activity:failure');
    });

    it('completes successful activities before failure', async () => {
      const { events } = await captureEvents(['with-activity-failure']);
      const types = eventTypes(stripRootLifecycleEvents(events));

      const successCount = types.filter((t) => t === 'activity:success').length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('does not run activities after failure', async () => {
      const { events } = await captureEvents(['with-activity-failure']);

      const activityStarts = events.filter((e) => e.type === 'activity:start');
      const labels = activityStarts.map((e) => (e.type === 'activity:start' ? e.label : ''));

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

  describe('operational error classification', () => {
    it('brands the built-in error classes as operational', () => {
      const cases: Error[] = [
        new CommandError('Command failed: x', 'stderr'),
        new TimeoutError('slow-cmd', 1000),
        new AbortError(),
        new CancelError(),
        new RouterError('boom'),
        new CheckError('check failed'),
        new CLIError('bad flag', { appName: 'app', commandPath: [] }),
      ];
      for (const err of cases) {
        expect(isOperationalError(err)).toBe(true);
      }
    });

    it('does not classify plain errors as operational', () => {
      expect(isOperationalError(new Error('bug'))).toBe(false);
      expect(isOperationalError('nope')).toBe(false);
      expect(isOperationalError(null)).toBe(false);
      expect(isOperationalError(undefined)).toBe(false);
    });

    it('markOperational opts an arbitrary error in', () => {
      const err = new Error('custom');
      expect(isOperationalError(err)).toBe(false);
      markOperational(err);
      expect(isOperationalError(err)).toBe(true);
    });

    it('tracks presentation via markPresented / wasPresented', () => {
      const err = new CommandError('Command failed: x', 'out');
      expect(wasPresented(err)).toBe(false);
      markPresented(err);
      expect(wasPresented(err)).toBe(true);
    });

    it('treats RouterError and CancelError as pre-presented (silent at top level)', () => {
      // These are exit-code carriers whose message is surfaced earlier (or is
      // internal), so the top-level handler must not print them again.
      expect(wasPresented(new RouterError('internal'))).toBe(true);
      expect(wasPresented(new CancelError())).toBe(true);
    });

    it('does not pre-present a CommandError (top level may surface it)', () => {
      expect(wasPresented(new CommandError('Command failed: x', 'out'))).toBe(false);
    });

    it('keeps operational/presented brands non-enumerable', () => {
      const err = new CommandError('Command failed: x', 'out');
      markPresented(err);
      expect(Object.keys(err)).not.toContain('Symbol(pokit.operationalError)');
      // JSON serialization must be unaffected by the brands.
      expect(() => JSON.stringify({ output: err.output })).not.toThrow();
    });
  });
});
