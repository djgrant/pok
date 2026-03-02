import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

import { defineCommand, defineCheck } from '../src';
import { createSdkRuntime } from '../src';
import { CheckError } from '../src/lib/check';

describe('SDK Runtime (in-process invoke)', () => {
  it('applies context defaults and validates required fields (no prompting)', async () => {
    const cmd = defineCommand({
      label: 'Defaults',
      context: {
        count: {
          from: 'flag',
          schema: z.number().default(2),
        },
        name: {
          from: 'flag',
          schema: z.string(),
        },
      },
      output: z.object({ msg: z.string() }),
      run: async (_r, ctx) => {
        return { msg: `${ctx.context.name}:${ctx.context.count}` };
      },
    });

    const rt = createSdkRuntime();
    await expect(
      rt.invoke(cmd, { cwd: process.cwd(), context: { count: 5 } as any })
    ).rejects.toThrow('Required flag --name is missing');

    const res = await rt.invoke(cmd, { cwd: process.cwd(), context: { name: 'a' } });
    expect(res).toEqual({ msg: 'a:2' });
    rt.close();
  });

  it('runs pre-checks and throws CheckError with remediation info', async () => {
    const failing = defineCheck({
      label: 'Fails',
      remediation: ['Do the thing'],
      check: async () => {
        throw new Error('nope');
      },
    });

    const cmd = defineCommand({
      label: 'With pre',
      pre: failing,
      run: async () => {},
    });

    const rt = createSdkRuntime();
    try {
      await rt.invoke(cmd, { cwd: process.cwd() });
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(CheckError);
      expect((e as CheckError).message).toContain('nope');
    } finally {
      rt.close();
    }
  });

  it('validates structured output against the output schema', async () => {
    const cmd = defineCommand({
      label: 'Bad output',
      output: z.object({ ok: z.boolean() }),
      run: async () => {
        return { ok: 'nope' } as any;
      },
    });

    const rt = createSdkRuntime();
    await expect(rt.invoke(cmd, { cwd: process.cwd() })).rejects.toThrow(
      'Command output did not match output schema'
    );
    rt.close();
  });
});

