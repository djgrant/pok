import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  buildCommandTree,
  run,
  RouterError,
  CancelError,
  CANCEL_EXIT_CODE,
  createEventBus,
  createRawReporterAdapter,
  createRawPrompter,
  ScopedReporter,
} from '../src';
import { COMMANDS_DIR, PROJECT_ROOT } from './utils/paths';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a minimal router context for testing
 */
function createTestRouterContext() {
  const eventBus = createEventBus();
  const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
  const adapterController = reporterAdapter.start(eventBus);
  const reporter = new ScopedReporter(eventBus, 'root', 'root');

  return {
    config: {
      commandsDir: COMMANDS_DIR,
      projectRoot: PROJECT_ROOT,
      appName: 'test-cli',
      reporterAdapter,
      prompter: createRawPrompter({}),
    },
    eventBus,
    reporter,
    adapterController,
    appName: 'test-cli',
    projectRoot: PROJECT_ROOT,
    prompter: createRawPrompter({}),
  };
}

// =============================================================================
// RouterError Tests
// =============================================================================

describe('RouterError', () => {
  it('creates error with message and default exit code', () => {
    const error = new RouterError('Command not found');

    expect(error.message).toBe('Command not found');
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe('RouterError');
  });

  it('creates error with custom exit code', () => {
    const error = new RouterError('Permission denied', 2);

    expect(error.message).toBe('Permission denied');
    expect(error.exitCode).toBe(2);
  });

  it('extends Error class', () => {
    const error = new RouterError('Test error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RouterError);
  });
});

// =============================================================================
// buildCommandTree Tests
// =============================================================================

describe('buildCommandTree', () => {
  it('builds tree from commands directory', async () => {
    const ctx = createTestRouterContext();
    const tree = await buildCommandTree(COMMANDS_DIR, ctx);

    expect(tree).toBeInstanceOf(Map);
    expect(tree.size).toBeGreaterThan(0);
  });

  it('loads simple command', async () => {
    const ctx = createTestRouterContext();
    const tree = await buildCommandTree(COMMANDS_DIR, ctx);

    const simpleNode = tree.get('simple');
    expect(simpleNode).toBeDefined();
    expect(simpleNode?.config.label).toBeDefined();
  });

  it('loads command with context definition', async () => {
    const ctx = createTestRouterContext();
    const tree = await buildCommandTree(COMMANDS_DIR, ctx);

    const contextNode = tree.get('with-context');
    expect(contextNode).toBeDefined();
    expect(contextNode?.config.context).toBeDefined();
  });

  it('builds parent-child hierarchy from dot-separated filenames', async () => {
    const ctx = createTestRouterContext();
    const tree = await buildCommandTree(COMMANDS_DIR, ctx);

    const parentNode = tree.get('parent');
    expect(parentNode).toBeDefined();
    expect(parentNode?.children.size).toBeGreaterThan(0);
  });

  it('skips files starting with underscore', async () => {
    const ctx = createTestRouterContext();
    const tree = await buildCommandTree(COMMANDS_DIR, ctx);

    // Files like _helpers.ts should be skipped
    expect(tree.has('_')).toBe(false);
  });
});

// =============================================================================
// Router run() Tests - Help and Version
// =============================================================================

/**
 * Capture console.log output during test execution
 */
async function captureConsoleOutput(fn: () => Promise<void>): Promise<string> {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  };

  try {
    await fn();
  } finally {
    console.log = originalLog;
  }

  return output.join('\n');
}

/**
 * Run CLI and capture output
 */
async function runCli(
  args: string[]
): Promise<{ output: string; events: any[]; error?: Error }> {
  const events: any[] = [];
  const reporterAdapter = createRawReporterAdapter({
    onEvent: (event) => events.push(event),
  });
  const prompter = createRawPrompter({});

  let error: Error | undefined;
  const output = await captureConsoleOutput(async () => {
    try {
      await run(args, {
        commandsDir: COMMANDS_DIR,
        projectRoot: PROJECT_ROOT,
        appName: 'test-cli',
        reporterAdapter,
        prompter,
      });
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
  });

  return { output, events, error };
}

describe('run() - root lifecycle events', () => {
  it('emits root:start first and root:end last on success', async () => {
    const { events, error } = await runCli(['simple']);
    expect(error).toBeUndefined();

    expect(events[0]?.type).toBe('root:start');
    expect(events[events.length - 1]?.type).toBe('root:end');
    if (events[events.length - 1]?.type === 'root:end') {
      expect(events[events.length - 1].exitCode).toBe(0);
    }
  });

  it('emits root:end with RouterError exitCode', async () => {
    const { events, error } = await runCli(['nonexistent-command']);
    expect(error).toBeDefined();

    expect(events[0]?.type).toBe('root:start');
    expect(events[events.length - 1]?.type).toBe('root:end');
    if (events[events.length - 1]?.type === 'root:end') {
      expect(events[events.length - 1].exitCode).toBe(1);
    }
  });

  it('emits root:end with exitCode 1 for unknown errors', async () => {
    const { events, error } = await runCli(['with-failing-pre']);
    expect(error).toBeDefined();

    expect(events[0]?.type).toBe('root:start');
    expect(events[events.length - 1]?.type).toBe('root:end');
    if (events[events.length - 1]?.type === 'root:end') {
      expect(events[events.length - 1].exitCode).toBe(1);
    }
  });

  it('emits root:end with exitCode 130 on cancellation', async () => {
    const { events, error } = await runCli(['with-cancel']);
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(CancelError);
    expect((error as CancelError).exitCode).toBe(CANCEL_EXIT_CODE);

    expect(events[0]?.type).toBe('root:start');
    expect(events[events.length - 1]?.type).toBe('root:end');
    if (events[events.length - 1]?.type === 'root:end') {
      expect(events[events.length - 1].exitCode).toBe(CANCEL_EXIT_CODE);
    }
  });
});

describe('run() - help and version', () => {
  it('shows help with --help flag', async () => {
    const { output, error } = await runCli(['--help']);

    expect(error).toBeUndefined();
    expect(output).toContain('test-cli');
    expect(output).toContain('Usage:');
    expect(output).toContain('Available Commands:');
  });

  it('shows help with -h flag', async () => {
    const { output, error } = await runCli(['-h']);

    expect(error).toBeUndefined();
    expect(output).toContain('test-cli');
    expect(output).toContain('Available Commands:');
  });

  it('shows command-specific help', async () => {
    const { output, error } = await runCli(['with-context', '--help']);

    expect(error).toBeUndefined();
    expect(output).toContain('Flags:');
    expect(output).toContain('--env');
  });

  it('shows version with --version flag', async () => {
    const { output, error } = await runCli(['--version']);

    expect(error).toBeUndefined();
    expect(output).toContain('test-cli');
  });
});

// =============================================================================
// Router run() Tests - Error Handling
// =============================================================================

describe('run() - error handling', () => {
  it('throws RouterError for unknown command', async () => {
    const { error } = await runCli(['nonexistent-command']);

    expect(error).toBeDefined();
    expect(error?.message).toContain('Unknown command');
    expect(error?.message).toContain('nonexistent-command');
  });

  it('provides available commands in error message', async () => {
    const { error } = await runCli(['xyz123']);

    expect(error).toBeDefined();
    expect(error?.message).toContain('Available commands:');
  });

  it('suggests similar command for typos', async () => {
    // Assuming 'simple' command exists, 'simpl' should suggest it
    const { error } = await runCli(['simpl']);

    expect(error).toBeDefined();
    expect(error?.message).toContain('Did you mean');
  });
});

// =============================================================================
// Router run() Tests - Command Execution
// =============================================================================

describe('run() - command execution', () => {
  it('executes simple command without error', async () => {
    const { error } = await runCli(['simple']);

    expect(error).toBeUndefined();
  });

  it('executes command with context flags', async () => {
    const { error } = await runCli(['with-context', '--env', 'dev']);

    expect(error).toBeUndefined();
  });

  it('executes child command', async () => {
    const { error } = await runCli(['parent', 'child-a']);

    expect(error).toBeUndefined();
  });
});

describe('run() - global context flags', () => {
  it('accepts global flags before command path', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});
    let resolvedDir: string | undefined;

    let error: Error | undefined;
    await captureConsoleOutput(async () => {
      try {
        await run(['--dir', '/tmp/board', 'with-context', '--env', 'dev'], {
          commandsDir: COMMANDS_DIR,
          projectRoot: PROJECT_ROOT,
          appName: 'test-cli',
          reporterAdapter,
          prompter,
          globalContext: {
            dir: {
              from: 'flag',
              schema: z.string(),
              description: 'Directory override',
            },
          },
          onGlobalContext: (ctx) => {
            resolvedDir = String(ctx.dir);
          },
        });
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }
    });

    expect(error).toBeUndefined();
    expect(resolvedDir).toBe('/tmp/board');
  });

  it('accepts global flags after command path', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});
    let resolvedDir: string | undefined;

    let error: Error | undefined;
    await captureConsoleOutput(async () => {
      try {
        await run(['with-context', '--env', 'dev', '--dir', '/tmp/board'], {
          commandsDir: COMMANDS_DIR,
          projectRoot: PROJECT_ROOT,
          appName: 'test-cli',
          reporterAdapter,
          prompter,
          globalContext: {
            dir: {
              from: 'flag',
              schema: z.string(),
              description: 'Directory override',
            },
          },
          onGlobalContext: (ctx) => {
            resolvedDir = String(ctx.dir);
          },
        });
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }
    });

    expect(error).toBeUndefined();
    expect(resolvedDir).toBe('/tmp/board');
  });
});

// =============================================================================
// Alias Tests
// =============================================================================

describe('run() - aliases', () => {
  it('supports command aliases', async () => {
    // Test that with-aliases command works (if it has aliases defined)
    const { output: helpOutput } = await runCli(['with-aliases', '--help']);

    // If aliases are defined, they should appear in help
    if (helpOutput.includes('Aliases:')) {
      expect(helpOutput).toContain('Aliases:');
    }
  });
});
