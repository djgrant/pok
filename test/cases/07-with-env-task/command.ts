import { z } from 'zod';
import { defineCommand } from '@openpok/core';
import { execWithEnv } from '../../shared/tasks';

export const command = defineCommand({
  label: 'Command with env task',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
      description: 'Target environment',
    },
  },
  run: async (r) => {
    await r.run(execWithEnv);
  },
});
