import { describe, it, expect } from 'bun:test';
import { captureEvents, stripRootLifecycleEvents } from './utils';

describe('Command Output', () => {
  describe('with --format json (via outputFormat)', () => {
    it('returns structured JSON on stdout', async () => {
      const { stdout, error } = await captureEvents(['with-output'], {
        outputFormat: 'json',
      });
      expect(error).toBeUndefined();
      const parsed = JSON.parse(stdout.trim());
      expect(parsed.tasks).toHaveLength(3);
      expect(parsed.total).toBe(3);
      expect(parsed.tasks[0].id).toBe('T-1');
    });

    it('filters by context flag and returns filtered JSON', async () => {
      const { stdout, error } = await captureEvents(
        ['with-output', '--status', 'done'],
        { outputFormat: 'json' }
      );
      expect(error).toBeUndefined();
      const parsed = JSON.parse(stdout.trim());
      expect(parsed.tasks).toHaveLength(1);
      expect(parsed.tasks[0].status).toBe('done');
      expect(parsed.total).toBe(1);
    });
  });

  describe('with human format (no --format flag)', () => {
    it('calls the format function and emits log events', async () => {
      const { events, error, stdout } = await captureEvents(['with-output']);
      expect(error).toBeUndefined();
      // No JSON on stdout — format function uses reporter
      expect(stdout.trim()).toBe('');

      const logEvents = stripRootLifecycleEvents(events).filter(
        (e) => e.type === 'log'
      );
      // format() emits: 1 "Found 3 tasks" + 3 task lines = 4 log events
      expect(logEvents.length).toBe(4);
      expect(logEvents[0]).toMatchObject({
        type: 'log',
        level: 'info',
        message: 'Found 3 tasks',
      });
    });
  });

  describe('backwards compatibility', () => {
    it('commands without output still work (return void)', async () => {
      const { error } = await captureEvents(['simple']);
      expect(error).toBeUndefined();
    });
  });
});
