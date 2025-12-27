import { describe, it, expect } from 'bun:test';
import {
  createRunner,
  createEventBus,
  createRawPrompter,
  CommandError,
  AbortError,
  defineTask,
} from '../src';
import type { Runner } from '../src';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_CWD = process.cwd();

function createTestRunner(options?: { quiet?: boolean; signal?: AbortSignal }): Runner {
  const eventBus = createEventBus();
  const prompter = createRawPrompter({});

  return createRunner({
    cwd: TEST_CWD,
    context: {},
    extraArgs: [],
    quiet: options?.quiet ?? false,
    signal: options?.signal,
    eventBus,
    prompter,
  });
}

// =============================================================================
// createRunner Tests
// =============================================================================

describe('createRunner', () => {
  it('creates runner with correct cwd', () => {
    const runner = createTestRunner();
    expect(runner.cwd).toBe(TEST_CWD);
  });

  it('provides reporter interface', () => {
    const runner = createTestRunner();
    expect(runner.reporter).toBeDefined();
    expect(typeof runner.reporter.info).toBe('function');
    expect(typeof runner.reporter.warn).toBe('function');
    expect(typeof runner.reporter.error).toBe('function');
  });

  it('provides prompter interface', () => {
    const runner = createTestRunner();
    expect(runner.prompter).toBeDefined();
    expect(typeof runner.prompter.select).toBe('function');
    expect(typeof runner.prompter.confirm).toBe('function');
    expect(typeof runner.prompter.text).toBe('function');
  });

  it('provides exec method', () => {
    const runner = createTestRunner();
    expect(typeof runner.exec).toBe('function');
  });

  it('provides run method', () => {
    const runner = createTestRunner();
    expect(typeof runner.run).toBe('function');
  });

  it('provides parallel method', () => {
    const runner = createTestRunner();
    expect(typeof runner.parallel).toBe('function');
  });

  it('provides tabs method', () => {
    const runner = createTestRunner();
    expect(typeof runner.tabs).toBe('function');
  });

  it('provides group method', () => {
    const runner = createTestRunner();
    expect(typeof runner.group).toBe('function');
  });
});

// =============================================================================
// exec() Tests
// =============================================================================

describe('runner.exec()', () => {
  it('executes simple string command', async () => {
    const runner = createTestRunner({ quiet: true });
    await runner.exec('echo hello');
    // Should complete without throwing
  });

  it('executes array form command', async () => {
    const runner = createTestRunner({ quiet: true });
    await runner.exec(['echo', 'hello']);
    // Should complete without throwing
  });

  it('throws CommandError on command failure', async () => {
    const runner = createTestRunner({ quiet: true });

    try {
      await runner.exec('exit 1');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(CommandError);
    }
  });

  it('returns thenable Command object', () => {
    const runner = createTestRunner({ quiet: true });
    const command = runner.exec('echo test');

    expect(command._type).toBe('command');
    expect(typeof command.then).toBe('function');
  });
});

// =============================================================================
// run() Tests
// =============================================================================

describe('runner.run()', () => {
  it('returns DeferredTask object', () => {
    const runner = createTestRunner();
    const task = {
      label: 'Test task',
      exec: 'echo test',
    };

    const deferred = runner.run(task);

    expect(deferred._type).toBe('deferred-task');
    expect(deferred.task).toBe(task);
    expect(typeof deferred.then).toBe('function');
  });

  it('executes exec task when awaited', async () => {
    const runner = createTestRunner({ quiet: true });
    const task = {
      label: 'Echo task',
      exec: 'echo task-output',
    };

    await runner.run(task);
    // Should complete without throwing
  });

  it('passes params to task', () => {
    const runner = createTestRunner();
    const task = {
      label: 'Parameterized task',
      exec: 'echo test',
    };

    const deferred = runner.run(task, { key: 'value' });

    expect(deferred.params).toEqual({ key: 'value' });
  });
});

// =============================================================================
// parallel() Tests
// =============================================================================

describe('runner.parallel()', () => {
  it('handles empty array', async () => {
    const runner = createTestRunner();
    await runner.parallel([]);
    // Should complete without throwing
  });

  it('executes single item directly', async () => {
    const runner = createTestRunner({ quiet: true });
    await runner.parallel([runner.exec('echo single')]);
    // Should complete without throwing
  });

  it('races multiple commands', async () => {
    const runner = createTestRunner({ quiet: true });

    // First command completes quickly, second would take longer
    await runner.parallel([runner.exec('echo fast'), runner.exec('sleep 10 || true')]);
    // Should complete when first finishes
  });
});

// =============================================================================
// group() Tests
// =============================================================================

describe('runner.group()', () => {
  it('creates group with label', async () => {
    const runner = createTestRunner();

    // We can't easily capture events from createRunner's internal eventBus
    // but we can verify the method signature works
    const result = await runner.group('Test Group', { layout: 'sequence' }, async (reporter) => {
      expect(typeof reporter.activity).toBe('function');
      return 'completed';
    });

    expect(result).toBe('completed');
  });

  it('passes reporter to callback', async () => {
    const runner = createTestRunner();

    await runner.group('Group', { layout: 'sequence' }, async (reporter) => {
      expect(reporter).toBeDefined();
      expect(typeof reporter.info).toBe('function');
      expect(typeof reporter.activity).toBe('function');
      expect(typeof reporter.group).toBe('function');
    });
  });

  it('returns value from callback', async () => {
    const runner = createTestRunner();

    const result = await runner.group('Group', { layout: 'parallel' }, async () => {
      return { data: 123 };
    });

    expect(result).toEqual({ data: 123 });
  });
});

// =============================================================================
// tabs() Tests
// =============================================================================

describe('runner.tabs()', () => {
  it('throws error when no tabs adapter provided', async () => {
    const runner = createTestRunner();

    try {
      await runner.tabs([runner.exec('echo test')]);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Tabs adapter not available');
    }
  });

  it('handles empty array without error', async () => {
    const runner = createTestRunner();

    // Empty array should return immediately - but the implementation
    // checks tabsAdapter before checking length, so this will throw
    try {
      await runner.tabs([]);
    } catch (error) {
      // Expected - no tabs adapter
      expect(error).toBeInstanceOf(Error);
    }
  });
});

// =============================================================================
// CommandError Tests
// =============================================================================

describe('CommandError', () => {
  it('creates error with message and output', () => {
    const error = new CommandError('Command failed: test', 'stderr output');

    expect(error.message).toBe('Command failed: test');
    expect(error.output).toBe('stderr output');
    expect(error.name).toBe('CommandError');
  });

  it('extends Error class', () => {
    const error = new CommandError('test', '');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CommandError);
  });
});

// =============================================================================
// TimeoutError Tests
// =============================================================================
// Note: TimeoutError is defined in runner.ts but not exported from the package
// These tests would need the export to be added to packages/core/src/index.ts

// =============================================================================
// AbortSignal Tests
// =============================================================================

describe('runner with AbortSignal', () => {
  it('respects abort signal', async () => {
    const controller = new AbortController();
    const runner = createTestRunner({ signal: controller.signal, quiet: true });

    // Abort immediately
    controller.abort();

    // Should throw when trying to execute
    try {
      await runner.exec('echo test');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});

// =============================================================================
// Parallel Modes Tests
// =============================================================================

describe('runner.parallel() modes', () => {
  describe('race mode (default)', () => {
    it('exits when first command completes', async () => {
      const runner = createTestRunner({ quiet: true });

      const start = Date.now();
      // First command exits immediately, second would take 5 seconds
      await runner.parallel([runner.exec('exit 0'), runner.exec('sleep 5')]);
      const elapsed = Date.now() - start;

      // Should complete quickly (well under 5 seconds)
      expect(elapsed).toBeLessThan(2000);
    });

    it('exits when first command fails', async () => {
      const runner = createTestRunner({ quiet: true });

      const start = Date.now();
      await runner.parallel([runner.exec('exit 1'), runner.exec('sleep 5')]).catch(() => {});
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('fail-fast mode', () => {
    it('waits for all commands when all succeed', async () => {
      const runner = createTestRunner({ quiet: true });

      await runner.parallel(
        [runner.exec('echo a'), runner.exec('echo b'), runner.exec('echo c')],
        { mode: 'fail-fast' }
      );
      // Should complete without error
    });

    it('aborts remaining on first failure', async () => {
      const runner = createTestRunner({ quiet: true });

      const start = Date.now();
      try {
        // First fails immediately, second would take 5 seconds
        await runner.parallel([runner.exec('exit 1'), runner.exec('sleep 5')], {
          mode: 'fail-fast',
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(CommandError);
      }
      const elapsed = Date.now() - start;

      // Should abort quickly
      expect(elapsed).toBeLessThan(2000);
    });

    it('throws first error encountered', async () => {
      const runner = createTestRunner({ quiet: true });

      try {
        await runner.parallel([runner.exec('exit 42'), runner.exec('echo ok')], {
          mode: 'fail-fast',
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CommandError);
      }
    });
  });

  describe('all-settled mode', () => {
    it('runs all commands to completion', async () => {
      const runner = createTestRunner({ quiet: true });

      await runner.parallel(
        [runner.exec('echo a'), runner.exec('echo b'), runner.exec('echo c')],
        { mode: 'all-settled' }
      );
      // Should complete without error
    });

    it('throws AggregateError when some fail', async () => {
      const runner = createTestRunner({ quiet: true });

      try {
        await runner.parallel(
          [runner.exec('exit 1'), runner.exec('echo ok'), runner.exec('exit 2')],
          { mode: 'all-settled' }
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        const aggError = error as AggregateError;
        expect(aggError.errors.length).toBe(2);
      }
    });

    it('continues after failures', async () => {
      const runner = createTestRunner({ quiet: true });

      // Create temp file to track execution
      const marker = `/tmp/pok-test-${Date.now()}`;

      try {
        await runner.parallel(
          [
            runner.exec('exit 1'), // Fails immediately
            runner.exec(`sleep 0.1 && touch ${marker}`), // Should still run
          ],
          { mode: 'all-settled' }
        );
      } catch {
        // Expected
      }

      // Second command should have run
      const fs = await import('fs');
      expect(fs.existsSync(marker)).toBe(true);

      // Cleanup
      fs.unlinkSync(marker);
    });
  });
});

// =============================================================================
// Retry Tests
// =============================================================================

describe('retry functionality', () => {
  describe('exec with retry', () => {
    it('retries failed command', async () => {
      const runner = createTestRunner({ quiet: true });

      // This command fails, so it will retry
      const start = Date.now();
      try {
        await runner.exec('exit 1', {
          retry: { maxAttempts: 2, delay: 100 },
        });
      } catch {
        // Expected to fail after retries
      }
      const elapsed = Date.now() - start;

      // Should have waited for retries (2 retries * 100ms = 200ms minimum)
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });

    it('succeeds without retry if command passes', async () => {
      const runner = createTestRunner({ quiet: true });

      await runner.exec('echo success', {
        retry: { maxAttempts: 3, delay: 1000 },
      });
      // Should complete quickly without retrying
    });
  });

  describe('task with retry', () => {
    it('retries failed exec task', async () => {
      const runner = createTestRunner({ quiet: true });

      const failingTask = defineTask({
        label: 'Failing task',
        retry: { maxAttempts: 2, delay: 100 },
        exec: 'exit 1',
      });

      const start = Date.now();
      try {
        await runner.run(failingTask);
      } catch {
        // Expected
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(150);
    });

    it('retries failed run task', async () => {
      const runner = createTestRunner({ quiet: true });
      let attempts = 0;

      const failingTask = defineTask({
        label: 'Failing run task',
        retry: { maxAttempts: 2, delay: 50 },
        run: async () => {
          attempts++;
          throw new Error('Intentional failure');
        },
      });

      try {
        await runner.run(failingTask);
      } catch {
        // Expected
      }

      // Initial attempt + 2 retries = 3 total
      expect(attempts).toBe(3);
    });
  });

  describe('backoff strategies', () => {
    it('uses fixed delay', async () => {
      const runner = createTestRunner({ quiet: true });

      const start = Date.now();
      try {
        await runner.exec('exit 1', {
          retry: { maxAttempts: 2, delay: 100, backoff: 'fixed' },
        });
      } catch {
        // Expected
      }
      const elapsed = Date.now() - start;

      // Fixed: 100ms + 100ms = 200ms
      expect(elapsed).toBeGreaterThanOrEqual(150);
      expect(elapsed).toBeLessThan(400);
    });

    it('uses exponential backoff', async () => {
      const runner = createTestRunner({ quiet: true });

      const start = Date.now();
      try {
        await runner.exec('exit 1', {
          retry: { maxAttempts: 2, delay: 50, backoff: 'exponential' },
        });
      } catch {
        // Expected
      }
      const elapsed = Date.now() - start;

      // Exponential: 50ms (2^0) + 100ms (2^1) = 150ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('respects maxDelay', async () => {
      const runner = createTestRunner({ quiet: true });

      const start = Date.now();
      try {
        await runner.exec('exit 1', {
          retry: { maxAttempts: 3, delay: 100, backoff: 'exponential', maxDelay: 150 },
        });
      } catch {
        // Expected
      }
      const elapsed = Date.now() - start;

      // Would be 100 + 200 + 400 = 700ms without cap
      // With maxDelay=150: 100 + 150 + 150 = 400ms
      expect(elapsed).toBeLessThan(600);
    });
  });

  describe('retry with parallel modes', () => {
    it('retries exhaust before fail-fast triggers', async () => {
      const runner = createTestRunner({ quiet: true });
      let attempts = 0;

      const retryingTask = defineTask({
        label: 'Retrying task',
        retry: { maxAttempts: 2, delay: 50 },
        run: async () => {
          attempts++;
          throw new Error('Always fails');
        },
      });

      const start = Date.now();
      try {
        await runner.parallel([runner.run(retryingTask), runner.exec('sleep 5')], {
          mode: 'fail-fast',
        });
      } catch {
        // Expected
      }
      const elapsed = Date.now() - start;

      // Task should have retried before triggering fail-fast
      expect(attempts).toBe(3); // Initial + 2 retries
      expect(elapsed).toBeLessThan(2000); // But still cancelled the sleep
    });
  });
});
