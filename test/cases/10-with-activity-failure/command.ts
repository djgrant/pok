import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Command with failing activity',
  run: async (r) => {
    await r.group('Work', { layout: 'sequence' }, async (group) => {
      await group.activity('Succeeds', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      await group.activity('Fails', async () => {
        throw new Error('Activity failed intentionally');
      });

      await group.activity('Never runs', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    });
  },
});
