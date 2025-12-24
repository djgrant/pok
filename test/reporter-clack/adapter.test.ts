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
});
