import { z } from 'zod';
import { defineCommand } from '@openpok/core';
import { mocks } from '@openpok/test-utils';

const { alwaysPass, secondCheck, conditionalCheck } = mocks;

export const command = defineCommand({
  label: 'Command with dynamic pre-checks',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
      description: 'Target environment',
    },
  },
  pre: (ctx) => {
    if (ctx.env === 'dev') {
      return [alwaysPass];
    }
    return [alwaysPass, secondCheck, conditionalCheck(true)];
  },
  run: async (r, { context }) => {
    await r.exec(`echo "Running in ${context.env} with appropriate checks"`);
  },
});
