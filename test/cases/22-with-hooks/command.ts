import { z } from 'zod';
import { defineCommand, definePreCommand, definePostCommand } from '@pokit/core';

/**
 * Records lifecycle steps for assertions. Tests reset this between runs;
 * captureEvents executes in-process so module state is shared with the test.
 */
export const calls: string[] = [];
export const resetCalls = (): void => {
  calls.length = 0;
};

const output = z.object({
  deployed: z.array(z.string()),
});

export const pre = definePreCommand({
  label: 'Prepare hooked command',
  pre: [
    {
      label: 'pre-command check',
      check: () => {
        calls.push('pre.check');
      },
    },
  ],
  run: async () => {
    calls.push('pre.run');
    return { prepared: true };
  },
});

export const command = defineCommand({
  label: 'Command with lifecycle hooks',
  context: {
    fail: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Throw from the main run to prove post is skipped',
    },
  },
  pre: [
    {
      label: 'main command check',
      check: () => {
        calls.push('main.check');
      },
    },
  ],
  output,
  format(data, r) {
    r.info(`deployed ${data.deployed.length}`);
  },
  run: async (_r, { context }) => {
    calls.push(
      `main.run prepared=${(context as Record<string, unknown>).prepared === true}`
    );
    if (context.fail) throw new Error('main run failed');
    return { deployed: ['pkg-a', 'pkg-b'] };
  },
});

export const post = definePostCommand({
  label: 'Reconcile hooked command',
  input: output.optional(),
  pre: [
    {
      label: 'post-command check',
      check: () => {
        calls.push('post.check');
      },
    },
  ],
  run: async (_r, ctx) => {
    calls.push(`post.run input=${ctx.input ? ctx.input.deployed.join(',') : 'none'}`);
  },
});
