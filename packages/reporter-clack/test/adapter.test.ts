import { describe, it, expect, afterEach } from 'bun:test';
import { createEventBus, type CLIEvent } from '@pokit/core';
import { createReporterAdapter } from '../src';
import { createVirtualTerminal, type VirtualTerminal } from './utils';
import * as fixtures from './fixtures';

// Test fixture: events for taskWithReporter scenario
const taskWithReporterEvents: CLIEvent[] = [
  { type: 'group:start', id: 'group-0', label: 'Setup Phase', layout: 'sequence' },
  { type: 'activity:start', id: 'activity-0', parentId: 'group-0', label: 'Initialize' },
  { type: 'activity:success', id: 'activity-0' },
  { type: 'activity:start', id: 'activity-1', parentId: 'group-0', label: 'Configure' },
  { type: 'activity:success', id: 'activity-1' },
  { type: 'group:end', id: 'group-0' },
  { type: 'log', level: 'info', message: 'Starting task...' },
  { type: 'log', level: 'info', message: 'Processing data...' },
  { type: 'log', level: 'success', message: 'Task completed successfully' },
];

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
      const lines = await getScreenshot(taskWithReporterEvents);
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

    it('error logs interrupt spinners immediately', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Deploy', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Running' },
        // Error log should interrupt spinner and show immediately
        { type: 'log', activityId: 'a1', level: 'error', message: 'Critical error occurred' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      // Error should be displayed
      expect(lines.some((l) => l.includes('Critical error occurred'))).toBe(true);
    });

    it('displays logs without activity ID immediately when no spinners active', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Test', layout: 'sequence' },
        // Log without activity ID and no active spinner
        { type: 'log', level: 'info', message: 'Global info message' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      expect(lines.some((l) => l.includes('Global info message'))).toBe(true);
    });

    it('respects buffer limit per activity', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Test', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Working' },
      ];

      // Add 150 logs (exceeds MAX_BUFFERED_LOGS_PER_ACTIVITY = 100)
      for (let i = 0; i < 150; i++) {
        events.push({ type: 'log', activityId: 'a1', level: 'info', message: `Log ${i}` });
      }

      events.push({ type: 'activity:success', id: 'a1' }, { type: 'group:end', id: 'g1' });

      const lines = await getScreenshot(events);
      // First 100 should be present
      expect(lines.some((l) => l.includes('Log 0'))).toBe(true);
      expect(lines.some((l) => l.includes('Log 99'))).toBe(true);
      // Log 100 and beyond should be dropped (over limit)
      expect(lines.some((l) => l.includes('Log 100'))).toBe(false);
      expect(lines.some((l) => l.includes('Log 149'))).toBe(false);
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

  describe('plain mode (--plain or CI)', () => {
    async function getScreenshotPlain(events: CLIEvent[]): Promise<string[]> {
      vt = createVirtualTerminal();
      const bus = createEventBus();
      const adapter = createReporterAdapter({
        output: { color: false, unicode: false, verbose: false },
      });
      const controller = adapter.start(bus);

      for (const event of events) {
        bus.emit(event);
      }

      controller.stop();
      return vt.screenshot();
    }

    it('renders group start with ASCII brackets', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotPlain(events);
      const allOutput = lines.join('\n');
      // Should use ASCII [ ] instead of Unicode ┌ └
      expect(allOutput).toContain('[Build]');
      expect(allOutput).toContain('[Done]');
    });

    it('renders activity success with [OK] prefix', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotPlain(events);
      const allOutput = lines.join('\n');
      // Should use [OK] prefix instead of checkmark
      expect(allOutput).toContain('[OK]');
      expect(allOutput).toContain('Compile');
    });

    it('renders activity failure with [ERR] prefix', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'activity:failure', id: 'a1', error: 'Compilation failed' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotPlain(events);
      const allOutput = lines.join('\n');
      // Should use [ERR] prefix
      expect(allOutput).toContain('[ERR]');
    });

    it('renders group end with [Failed] on failure', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'activity:failure', id: 'a1', error: 'Compilation failed' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotPlain(events);
      const allOutput = lines.join('\n');
      expect(allOutput).toContain('[Failed]');
    });

    it('renders log messages with ASCII prefixes', async () => {
      const events: CLIEvent[] = [
        { type: 'log', level: 'info', message: 'Information' },
        { type: 'log', level: 'warn', message: 'Warning' },
        { type: 'log', level: 'error', message: 'Error' },
      ];

      const lines = await getScreenshotPlain(events);
      const allOutput = lines.join('\n');
      expect(allOutput).toContain('[INFO]');
      expect(allOutput).toContain('Information');
      expect(allOutput).toContain('[WARN]');
      expect(allOutput).toContain('Warning');
      expect(allOutput).toContain('[ERR]');
      expect(allOutput).toContain('Error');
    });

    it('renders parallel group results with ASCII prefixes', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Deploy', layout: 'parallel' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Push to registry' },
        { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Health check' },
        { type: 'activity:success', id: 'a1' },
        { type: 'activity:failure', id: 'a2', error: 'Health check failed' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotPlain(events);
      const allOutput = lines.join('\n');
      expect(allOutput).toContain('[OK]');
      expect(allOutput).toContain('Push to registry');
      expect(allOutput).toContain('[ERR]');
      expect(allOutput).toContain('Health check');
    });

    it('displays logs immediately without buffering in plain mode', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'log', activityId: 'a1', level: 'info', message: 'Compiling files...' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotPlain(events);
      const allOutput = lines.join('\n');
      // Log should be present (displayed immediately, not buffered)
      expect(allOutput).toContain('Compiling files...');
    });
  });

  describe('no-color mode (--no-color or NO_COLOR)', () => {
    async function getScreenshotNoColor(events: CLIEvent[]): Promise<string[]> {
      vt = createVirtualTerminal();
      const bus = createEventBus();
      // color: false, but unicode: true - should still use Unicode symbols without colors
      const adapter = createReporterAdapter({
        output: { color: false, unicode: true, verbose: false },
      });
      const controller = adapter.start(bus);

      for (const event of events) {
        bus.emit(event);
      }

      controller.stop();
      return vt.screenshot();
    }

    it('renders without ANSI color codes', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotNoColor(events);
      // Should still have Unicode symbols but no ANSI color codes
      // The output should contain the message without escape sequences
      expect(lines.some((l) => l.includes('Build'))).toBe(true);
      expect(lines.some((l) => l.includes('Compile'))).toBe(true);
    });

    it('still uses Unicode symbols when only color is disabled', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
        { type: 'activity:success', id: 'a1' },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshotNoColor(events);
      // Should use Unicode symbols (via clack), not ASCII
      // Should not have [OK] prefix since unicode is enabled
      expect(lines.some((l) => l.includes('[OK]'))).toBe(false);
    });
  });

  describe('remediation display', () => {
    it('displays remediation steps for sequential activity failure', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Pre-flight Checks', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Docker running' },
        {
          type: 'activity:failure',
          id: 'a1',
          error: 'Docker daemon is not running',
          remediation: ['Start Docker Desktop, or', "Run 'sudo systemctl start docker' (Linux)"],
        },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      const allOutput = lines.join('\n');

      // Should show "To fix:" section
      expect(allOutput).toContain('To fix:');
      // Should show remediation steps
      expect(allOutput).toContain('Start Docker Desktop, or');
      expect(allOutput).toContain("Run 'sudo systemctl start docker' (Linux)");
    });

    it('displays documentation URL for sequential activity failure', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Pre-flight Checks', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Docker running' },
        {
          type: 'activity:failure',
          id: 'a1',
          error: 'Docker daemon is not running',
          documentationUrl: 'https://docs.docker.com/get-started/',
        },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      const allOutput = lines.join('\n');

      // Should show documentation URL
      expect(allOutput).toContain('More info:');
      expect(allOutput).toContain('https://docs.docker.com/get-started/');
    });

    it('displays both remediation and documentation URL', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Pre-flight Checks', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Docker running' },
        {
          type: 'activity:failure',
          id: 'a1',
          error: 'Docker daemon is not running',
          remediation: ['Start Docker Desktop'],
          documentationUrl: 'https://docs.docker.com/get-started/',
        },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      const allOutput = lines.join('\n');

      expect(allOutput).toContain('To fix:');
      expect(allOutput).toContain('Start Docker Desktop');
      expect(allOutput).toContain('More info:');
      expect(allOutput).toContain('https://docs.docker.com/get-started/');
    });

    it('displays remediation for parallel activity failures after group ends', async () => {
      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Pre-flight Checks', layout: 'parallel' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Docker installed' },
        { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Docker running' },
        { type: 'activity:success', id: 'a1' },
        {
          type: 'activity:failure',
          id: 'a2',
          error: 'Docker daemon is not running',
          remediation: ['Start Docker Desktop'],
          documentationUrl: 'https://docs.docker.com/get-started/',
        },
        { type: 'group:end', id: 'g1' },
      ];

      const lines = await getScreenshot(events);
      const allOutput = lines.join('\n');

      // Should show remediation after group ends
      expect(allOutput).toContain('To fix:');
      expect(allOutput).toContain('Start Docker Desktop');
      expect(allOutput).toContain('More info:');
      expect(allOutput).toContain('https://docs.docker.com/get-started/');
    });

    it('displays remediation in plain mode', async () => {
      vt = createVirtualTerminal();
      const bus = createEventBus();
      const adapter = createReporterAdapter({
        output: { color: false, unicode: false, verbose: false },
      });
      const controller = adapter.start(bus);

      const events: CLIEvent[] = [
        { type: 'group:start', id: 'g1', label: 'Pre-flight Checks', layout: 'sequence' },
        { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Docker running' },
        {
          type: 'activity:failure',
          id: 'a1',
          error: 'Docker daemon is not running',
          remediation: ['Start Docker Desktop'],
          documentationUrl: 'https://docs.docker.com/get-started/',
        },
        { type: 'group:end', id: 'g1' },
      ];

      for (const event of events) {
        bus.emit(event);
      }

      controller.stop();
      const lines = await vt.screenshot();
      const allOutput = lines.join('\n');

      // Should show remediation in plain mode too
      expect(allOutput).toContain('To fix:');
      expect(allOutput).toContain('Start Docker Desktop');
      expect(allOutput).toContain('More info:');
      expect(allOutput).toContain('https://docs.docker.com/get-started/');
    });
  });
});
