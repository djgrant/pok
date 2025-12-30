import { z } from 'zod';
import { defineCommand } from '@pokjs/core';
import { tasks } from '@pokjs/test-utils';

const { execSimple, execWithParams } = tasks;

export const command = defineCommand({
  label: 'Command that runs tasks',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
      description: 'Target environment',
    },
  },
  run: async (r) => {
    await r.run(execSimple);
    await r.run(execWithParams, { message: 'Hello from task!' });
  },
});
