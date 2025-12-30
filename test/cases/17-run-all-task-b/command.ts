import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Task B',
  run: async (r) => {
    await r.exec('echo "Task B complete"');
  },
});
