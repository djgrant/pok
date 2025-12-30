import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Task A',
  run: async (r) => {
    await r.exec('echo "Task A complete"');
  },
});
