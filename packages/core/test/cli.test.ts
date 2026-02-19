import { describe, it, expect } from 'bun:test';
import { runCli, RouterError, CancelError, createRawReporterAdapter, createRawPrompter } from '../src';
import { COMMANDS_DIR, PROJECT_ROOT } from './utils/paths';

describe('runCli() - embeddability', () => {
  it('does not call process.exit on RouterError', async () => {
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
      ).rejects.toBeInstanceOf(RouterError);
    } finally {
      (process as any).exit = originalExit;
    }
  });

  it('does not call process.exit on CancelError', async () => {
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
      ).rejects.toBeInstanceOf(CancelError);
    } finally {
      (process as any).exit = originalExit;
    }
  });
});
