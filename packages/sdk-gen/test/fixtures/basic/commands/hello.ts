import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Hello',
  context: {
    name: {
      from: 'flag',
      schema: z.string().default('world'),
    },
  },
  output: z.object({
    greeting: z.string(),
  }),
  run: async (_r, ctx) => {
    return { greeting: `hello ${ctx.context.name}` };
  },
});

