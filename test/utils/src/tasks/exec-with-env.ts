import { defineTask } from '@pokit/core';
import { mockEnv } from '../mocks/env';

export const execWithEnv = defineTask({
  label: 'Exec task with env',
  env: mockEnv,
  exec: (ctx) => {
    return `echo "API_KEY=${ctx.envs.API_KEY}"`;
  },
});
