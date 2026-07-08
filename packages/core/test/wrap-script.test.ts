import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { wrapScript } from '../src/lib/wrap-script';

// Minimal fake runner that records exec() invocations.
function fakeRunner() {
  const calls: unknown[][] = [];
  const runner = {
    exec: (argv: unknown) => {
      calls.push(argv as unknown[]);
      return Promise.resolve();
    },
  };
  return { runner, calls };
}

describe('wrapScript', () => {
  it('builds argv from context and spawns the array form (no shell)', async () => {
    const cmd = wrapScript({
      label: 'Echo',
      context: { words: { from: 'args' as const, schema: z.array(z.string()).default([]) } },
      argv: ({ words }) => ['echo', ...words],
    });

    const { runner, calls } = fakeRunner();
    await cmd.run!(runner as any, { context: { words: ['a', 'b'] }, extraArgs: [], cwd: '/' } as any);
    expect(calls[0]).toEqual(['echo', 'a', 'b']);
  });

  it('appends extraArgs (passthrough) after the base argv', async () => {
    const cmd = wrapScript({
      label: 'Echo',
      context: { words: { from: 'args' as const, schema: z.array(z.string()).default([]) } },
      argv: ({ words }) => ['echo', ...words],
    });

    const { runner, calls } = fakeRunner();
    await cmd.run!(runner as any, {
      context: { words: ['hi'] },
      extraArgs: ['-n', '--json'],
      cwd: '/',
    } as any);
    expect(calls[0]).toEqual(['echo', 'hi', '-n', '--json']);
  });

  it('enables ignoreUnknownFlags by default and can be disabled', () => {
    expect(wrapScript({ label: 'x', argv: () => ['x'] }).ignoreUnknownFlags).toBe(true);
    expect(
      wrapScript({ label: 'x', argv: () => ['x'], passthrough: false }).ignoreUnknownFlags
    ).toBe(false);
  });

  it('does not append extraArgs when passthrough is disabled', async () => {
    const cmd = wrapScript({
      label: 'Echo',
      passthrough: false,
      argv: () => ['echo', 'x'],
    });
    const { runner, calls } = fakeRunner();
    await cmd.run!(runner as any, { context: {}, extraArgs: ['--nope'], cwd: '/' } as any);
    expect(calls[0]).toEqual(['echo', 'x']);
  });
});
