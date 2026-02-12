import { defineCommand } from '@pokit/core';
import { z } from 'zod';

export const command = defineCommand({
  label: 'Context alpha',
  context: {
    env: {
      from: 'flag' as const,
      schema: z.enum(['dev', 'prod']),
      description: 'Environment',
    },
  },
  run: async (_r, ctx) => {
    if (!ctx.context.env) {
      throw new Error('missing env');
    }
  },
});
