import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Command with nested groups',
  run: async (r) => {
    await r.group('Build Pipeline', { layout: 'sequence' }, async (outer) => {
      await outer.activity('Prepare', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      await r.group('Compile Phase', { layout: 'sequence' }, async (inner) => {
        await inner.activity('Compile TypeScript', async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });

        await inner.activity('Bundle assets', async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      });

      await outer.activity('Finalize', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    });
  },
});
