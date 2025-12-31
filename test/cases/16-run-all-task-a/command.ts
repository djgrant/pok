import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Task A',
  run: async (r) => {
    await r.exec('echo "Task A complete"');
  },
});
