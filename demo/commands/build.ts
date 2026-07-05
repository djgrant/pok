import { defineCommand } from '@pokit/core';

// Task-style command: nested r.group() with r.exec() activities. Good for
// eyeballing the reporter's grouped/sequenced rendering.
export const command = defineCommand({
  label: 'Build pipeline',
  description: 'Grouped tasks with r.group / r.exec',
  run: async (r) => {
    await r.group('Build', { layout: 'sequence' }, async (build) => {
      await build.activity('Install deps', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      await r.group('Compile', { layout: 'sequence' }, async (compile) => {
        await compile.activity('Compile TypeScript', async () => {
          await r.exec('echo "tsc --build"');
        });
        await compile.activity('Bundle', async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
      });

      await build.activity('Report', async () => {
        await r.exec('echo "build complete"');
      });
    });
  },
});
