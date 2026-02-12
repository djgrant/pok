import { defineCommand } from '@pokit/core';
import { z } from 'zod';

export const command = defineCommand({
  label: 'Context beta',
  context: {
    name: {
      from: 'flag' as const,
      schema: z.string().min(1),
      description: 'Name',
    },
  },
  run: async (_r, ctx) => {
    if (!ctx.context.name) {
      throw new Error('missing name');
    }
  },
});
