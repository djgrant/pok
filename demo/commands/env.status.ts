import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Show status',
  description: 'Child of the Environments menu',
  run: async (r) => {
    await r.exec('echo "env: all systems nominal"');
  },
});
