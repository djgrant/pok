import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Reset environment',
  description: 'Child of the Environments menu (typed flag)',
  context: {
    target: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
      description: 'Environment to reset',
    },
  },
  run: async (r, { context }) => {
    await r.exec(`echo "resetting ${context.target}"`);
  },
});
