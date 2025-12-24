import { z } from 'zod';
import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Command with context',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
      description: 'Target environment',
    },
    verbose: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Enable verbose output',
    },
  },
  run: async (r, { context }) => {
    await r.exec(`echo "Running in ${context.env} mode, verbose=${context.verbose}"`);
  },
});
