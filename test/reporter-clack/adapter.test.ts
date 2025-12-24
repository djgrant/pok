import { describe, it, expect, afterEach } from 'bun:test';
import { createEventBus, type CLIEvent } from '@openpok/core';
import { createReporterAdapter } from '@openpok/reporter-clack';
import { createVirtualTerminal, type VirtualTerminal } from './utils';
import * as cliFixtures from '../core/fixtures';
import * as fixtures from './fixtures';

describe('ClackReporterAdapter', () => {
  let vt: VirtualTerminal | undefined;

  afterEach(() => {
    vt?.restore();
    vt = undefined;
  });

  async function getScreenshot(events: CLIEvent[]): Promise<string[]> {
    vt = createVirtualTerminal();
    const bus = createEventBus();
    const adapter = createReporterAdapter();
    const controller = adapter.start(bus);

    for (const event of events) {
      bus.emit(event);
    }

    controller.stop();
    return vt.screenshot();
  }

  describe('sequential groups', () => {
    it('renders group with activities and logs', async () => {
      const lines = await getScreenshot(cliFixtures.taskWithReporter.events);
      expect(lines).toEqual(fixtures.sequentialGroup.lines);
    });
  });

  describe('activity lifecycle', () => {
    it('renders successful activity with checkmark', async () => {
      const events: CLIEvent[] = [
        {
          type: 'group:start',
          id: 'g1',
          label: 'Test Group',
          layout: 'sequence',
        },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'My Task' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.activitySuccess.lines);
    });

    it('renders failed activity with error message', async () => {
      const events: CLIEvent[] = [
        {
          type: 'group:start',
          id: 'g1',
          label: 'Test Group',
          layout: 'sequence',
        },
        {
          type: 'activity:start',
          id: 'a1',
          parentId: 'g1',
          label: 'Failing Task',
        },
        { type: 'activity:failure', id: 'a1', error: 'Something went wrong' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.activityFailure.lines);
    });
  });

  describe('log events', () => {
    it('renders info log', async () => {
      const events: CLIEvent[] = [{ type: 'log', level: 'info', message: 'Information message' }];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.logInfo.lines);
    });

    it('renders success log', async () => {
      const events: CLIEvent[] = [{ type: 'log', level: 'success', message: 'Success message' }];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.logSuccess.lines);
    });

    it('renders error log', async () => {
      const events: CLIEvent[] = [{ type: 'log', level: 'error', message: 'Error message' }];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.logError.lines);
    });

    it('renders warn log', async () => {
      const events: CLIEvent[] = [{ type: 'log', level: 'warn', message: 'Warning message' }];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.logWarn.lines);
    });

    it('renders step log', async () => {
      const events: CLIEvent[] = [{ type: 'log', level: 'step', message: 'Step message' }];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.logStep.lines);
    });
  });

  describe('multiple activities', () => {
    it('renders all activities in sequence', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'activity:success', id: 'a1' },
        { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Bundle' },
        { type: 'activity:success', id: 'a2' },
        { type: 'activity:start', id: 'a3', parentId: 'g1', label: 'Minify' },
        { type: 'activity:success', id: 'a3' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.multipleActivities.lines);
    });
  });

  describe('parallel groups', () => {
    it('renders parallel group with successful activities', async () => {
      const events: CLIEvent[] = [
        {
          type: 'group:start',
          id: 'g1',
          label: 'Parallel Tasks',
          layout: 'parallel',
        },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Task A' },
        { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Task B' },
        { type: 'activity:success', id: 'a1' },
        { type: 'activity:success', id: 'a2' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.parallelGroupSuccess.lines);
    });

    it('renders parallel group with one failing activity', async () => {
      const events: CLIEvent[] = [
        {
          type: 'group:start',
          id: 'g1',
          label: 'Parallel Tasks',
          layout: 'parallel',
        },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Task A' },
        { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Task B' },
        { type: 'activity:success', id: 'a1' },
        { type: 'activity:failure', id: 'a2', error: 'Task B failed' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.parallelGroupFailure.lines);
    });
  });

  describe('suspend and resume', () => {
    it('suppresses output when suspended', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Test', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Running' },
        { type: 'reporter:suspend' },
        { type: 'log', level: 'info', message: 'Should not appear' },
        { type: 'reporter:resume' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      expect(lines).toEqual(fixtures.suspendResume.lines);
    });
  });

  describe('log buffering', () => {
    it('buffers logs during sequential activity and flushes on completion', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Deploy', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Deploy' },
        // These logs are emitted during spinner activity
        { type: 'log', activityId: 'a1', level: 'warn', message: 'Rate limit approaching' },
        { type: 'log', activityId: 'a1', level: 'error', message: 'Rollback recommended' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      // Logs should appear after activity completes
      expect(lines.some((l) => l.includes('Rate limit approaching'))).toBe(true);
      expect(lines.some((l) => l.includes('Rollback recommended'))).toBe(true);
    });

    it('buffers logs during parallel activities and flushes at group end', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Parallel Deploy', layout: 'parallel' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Task A' },
        { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Task B' },
        // Logs during parallel activities
        { type: 'log', activityId: 'a1', level: 'info', message: 'Task A info' },
        { type: 'log', activityId: 'a2', level: 'warn', message: 'Task B warning' },
        { type: 'activity:success', id: 'a1' },
        { type: 'activity:success', id: 'a2' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      // Logs should appear after group ends
      expect(lines.some((l) => l.includes('Task A info'))).toBe(true);
      expect(lines.some((l) => l.includes('Task B warning'))).toBe(true);
    });

    it('does not lose logs during activity', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Test', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Working' },
        { type: 'log', activityId: 'a1', level: 'info', message: 'Important info' },
        { type: 'log', activityId: 'a1', level: 'warn', message: 'Critical warning' },
        { type: 'log', activityId: 'a1', level: 'success', message: 'Partial success' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      // All logs should be preserved
      expect(lines.some((l) => l.includes('Important info'))).toBe(true);
      expect(lines.some((l) => l.includes('Critical warning'))).toBe(true);
      expect(lines.some((l) => l.includes('Partial success'))).toBe(true);
    });

    it('flushes logs in correct order by timestamp', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Test', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Working' },
        { type: 'log', activityId: 'a1', level: 'info', message: 'First' },
        { type: 'log', activityId: 'a1', level: 'info', message: 'Second' },
        { type: 'log', activityId: 'a1', level: 'info', message: 'Third' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      const firstIdx = lines.findIndex((l) => l.includes('First'));
      const secondIdx = lines.findIndex((l) => l.includes('Second'));
      const thirdIdx = lines.findIndex((l) => l.includes('Third'));

      // Order should be preserved
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it('flushes logs on activity failure too', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Test', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Failing' },
        { type: 'log', activityId: 'a1', level: 'warn', message: 'Warning before failure' },
        { type: 'activity:failure', id: 'a1', error: 'Task failed' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      // Log should still appear even after failure
      expect(lines.some((l) => l.includes('Warning before failure'))).toBe(true);
    });
  });

  describe('verbose mode', () => {
    async function getScreenshotVerbose(events: CLIEvent[]): Promise<string[]> {
      vt = createVirtualTerminal();
      const bus = createEventBus();
      const adapter = createReporterAdapter({ verbose: true });
      const controller = adapter.start(bus);

      for (const event of events) {
        bus.emit(event);
      }

      controller.stop();
      return vt.screenshot();
    }

    it('displays logs immediately in verbose mode', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Deploy', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Deploy' },
        { type: 'log', activityId: 'a1', level: 'info', message: 'Immediate log' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotVerbose(events);
      expect(lines.some((l) => l.includes('Immediate log'))).toBe(true);
    });
  });
});
