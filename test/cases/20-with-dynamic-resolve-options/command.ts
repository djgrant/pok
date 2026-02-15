import { z } from 'zod';
import { defineCommand } from '@pokit/core';

const TASKS = [
  { id: 'TASK-001', title: 'First task' },
  { id: 'TASK-002', title: 'Second task' },
] as const;

async function listTaskOptionPage({ cursor }: { cursor?: string }) {
  const start = cursor ? Number(cursor) : 0;
  const pageSize = 1;
  const slice = TASKS.slice(start, start + pageSize);

  await new Promise((r) => setTimeout(r, 10));

  return {
    options: slice.map((task) => task.id),
    nextCursor: start + pageSize < TASKS.length ? String(start + pageSize) : undefined,
  };
}

export const command = defineCommand({
  label: 'Command with dynamic resolve options',
  context: {
    id: {
      from: 'flag',
      schema: z.string(),
      description: 'Task id',
      resolve: async ({ cursor }) => listTaskOptionPage({ cursor }),
    },
  },
  run: async (_r, { context }) => {
    if (context.id !== 'TASK-001' && context.id !== 'TASK-002') {
      throw new Error(`Unexpected selected id: ${context.id}`);
    }
  },
});
