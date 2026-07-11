import { describe, it, expect, afterEach } from 'bun:test';
import { runCli, RouterError, CancelError, createRawReporterAdapter, createRawPrompter } from '../src';
import { COMMANDS_DIR, PROJECT_ROOT } from './utils/paths';

describe('runCli() - embeddability', () => {
  // runCli sets `process.exitCode` on operational errors (its normal
  // entrypoint behavior). Several tests here exercise that failure path, which
  // would otherwise leave the test runner's own process.exitCode non-zero and
  // fail the whole `bun test` run despite every assertion passing.
  afterEach(() => {
    process.exitCode = 0;
  });

  it('returns RouterError exit code by default', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});

    const originalExit = process.exit;
    (process as any).exit = (code?: number) => {
      throw new Error(`process.exit(${code}) called`);
    };

    try {
      await expect(
        runCli(['nonexistent-command'], {
          commandsDir: COMMANDS_DIR,
          projectRoot: PROJECT_ROOT,
          appName: 'test-cli',
          reporterAdapter,
          prompter,
        })
      ).resolves.toBe(1);
    } finally {
      (process as any).exit = originalExit;
    }
  });

  it('returns CancelError exit code by default', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});

    const originalExit = process.exit;
    (process as any).exit = (code?: number) => {
      throw new Error(`process.exit(${code}) called`);
    };

    try {
      await expect(
        runCli(['with-cancel'], {
          commandsDir: COMMANDS_DIR,
          projectRoot: PROJECT_ROOT,
          appName: 'test-cli',
          reporterAdapter,
          prompter,
        })
      ).resolves.toBe(130);
    } finally {
      (process as any).exit = originalExit;
    }
  });

  it('can rethrow RouterError with throwOnError', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});

    await expect(
      runCli(['nonexistent-command'], {
        commandsDir: COMMANDS_DIR,
        projectRoot: PROJECT_ROOT,
        appName: 'test-cli',
        reporterAdapter,
        prompter,
        throwOnError: true,
      })
    ).rejects.toBeInstanceOf(RouterError);
  });

  it('can rethrow CancelError with throwOnError', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});

    await expect(
      runCli(['with-cancel'], {
        commandsDir: COMMANDS_DIR,
        projectRoot: PROJECT_ROOT,
        appName: 'test-cli',
        reporterAdapter,
        prompter,
        throwOnError: true,
      })
    ).rejects.toBeInstanceOf(CancelError);
  });

  it('returns success code on successful run', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});

    await expect(
      runCli(['simple'], {
        commandsDir: COMMANDS_DIR,
        projectRoot: PROJECT_ROOT,
        appName: 'test-cli',
        reporterAdapter,
        prompter,
      })
    ).resolves.toBe(0);
  });

  it('does not call process.exit on failures', async () => {
    const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
    const prompter = createRawPrompter({});

    const originalExit = process.exit;
    (process as any).exit = (code?: number) => {
      throw new Error(`process.exit(${code}) called`);
    };

    try {
      await expect(
        runCli(['nonexistent-command'], {
          commandsDir: COMMANDS_DIR,
          projectRoot: PROJECT_ROOT,
          appName: 'test-cli',
          reporterAdapter,
          prompter,
        })
      ).resolves.toBe(1);
    } finally {
      (process as any).exit = originalExit;
    }
  });
});
