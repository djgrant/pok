import { z } from 'zod';
import { defineCommand } from '@pokit/core';

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['todo', 'in-progress', 'done']),
});

export const command = defineCommand({
  label: 'List tasks',
  context: {
    status: {
      from: 'flag',
      schema: z.enum(['todo', 'in-progress', 'done']).optional(),
      description: 'Filter by status',
    },
  },
  output: z.object({
    tasks: z.array(taskSchema),
    total: z.number(),
  }),
  format(data, r) {
    r.info(`Found ${data.total} tasks`);
    for (const t of data.tasks) {
      r.info(`  ${t.id}  ${t.title}  [${t.status}]`);
    }
  },
  run: async (_r, { context }) => {
    const allTasks = [
      { id: 'T-1', title: 'Build output system', status: 'in-progress' as const },
      { id: 'T-2', title: 'Write tests', status: 'todo' as const },
      { id: 'T-3', title: 'Ship it', status: 'done' as const },
    ];
    const tasks = context.status
      ? allTasks.filter((t) => t.status === context.status)
      : allTasks;
    return { tasks, total: tasks.length };
  },
});
