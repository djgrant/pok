import { z } from 'zod';
import { defineTask } from '@openpok/core';

export const execWithParams = defineTask({
  label: 'Exec task with params',
  params: z.object({
    message: z.string().default('Hello'),
    count: z.number().default(1),
  }),
  exec: (ctx) => {
    const messages = Array(ctx.params.count).fill(ctx.params.message).join(' ');
    return `echo "${messages}"`;
  },
});

export const execWithEnvAndParams = defineTask({
  label: 'Exec task with env and params',
  params: z.object({
    endpoint: z.string(),
  }),
  exec: (ctx) => {
    return `echo "Calling ${ctx.params.endpoint}"`;
  },
});
