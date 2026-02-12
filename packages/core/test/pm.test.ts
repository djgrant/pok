import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createPmAction, parsePmCommand, tokenizeCommand } from '../src/lib/pm';

describe('tokenizeCommand', () => {
  it('preserves literal backslashes in paths', () => {
    const tokens = tokenizeCommand('pnpm -C C:\\work\\repo run build');
    expect(tokens).toEqual(['pnpm', '-C', 'C:\\work\\repo', 'run', 'build']);
  });
});

describe('parsePmCommand', () => {
  it('parses yarn workspace run script token correctly', () => {
    const parsed = parsePmCommand('yarn workspace web run dev');
    expect(parsed).toEqual({
      pm: 'yarn',
      targetName: 'web',
      commandToken: 'run',
      scriptToken: 'dev',
    });
  });

  it('parses yarn workspace direct command token correctly', () => {
    const parsed = parsePmCommand('yarn workspace web lint');
    expect(parsed).toEqual({
      pm: 'yarn',
      targetName: 'web',
      commandToken: 'lint',
      scriptToken: 'lint',
    });
  });
});

describe('createPmAction', () => {
  it('executes run actions with argv arrays and preserves extra args', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-action-run-'));
    fs.writeFileSync(path.join(projectDir, 'pnpm-lock.yaml'), '');

    const action = createPmAction('run', 'build', projectDir, true);
    let capturedCmd: unknown = null;
    await action.run!(
      {
        exec: async (cmd: unknown) => {
          capturedCmd = cmd;
        },
      } as any,
      {
        extraArgs: ['--mode', 'production build'],
      } as any
    );

    expect(capturedCmd).toEqual(['pnpm', 'run', 'build', '--', '--mode', 'production build']);
  });

  it('executes pnpm workspace exec actions with -w flag tokenized', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-action-exec-'));
    fs.writeFileSync(path.join(projectDir, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(projectDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');

    const action = createPmAction('exec', 'install', projectDir);
    let capturedCmd: unknown = null;
    await action.run!(
      {
        exec: async (cmd: unknown) => {
          capturedCmd = cmd;
        },
      } as any,
      {
        extraArgs: ['foo'],
      } as any
    );

    expect(capturedCmd).toEqual(['pnpm', 'install', '-w', 'foo']);
  });
});
