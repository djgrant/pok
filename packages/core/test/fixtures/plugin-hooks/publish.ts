import { z } from 'zod';
import { definePostCommand } from '../../../src';
import { calls } from './_calls';

// Hooks-only route file: `publish` itself is mounted by a plugin.
export const post = definePostCommand({
  label: 'After publish',
  input: z.object({ published: z.array(z.string()) }).optional(),
  run: async (_r, ctx) => {
    calls.push(`post.run input=${ctx.input ? ctx.input.published.join(',') : 'none'}`);
  },
});
