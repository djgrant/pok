import { defineCommand } from '@openpok/core';
import { tasks } from '@openpok/test-utils';

const { runWithReporter } = tasks;

export const command = defineCommand({
  label: 'Command with reporter output',
  run: async (r) => {
    await r.group('Setup Phase', { layout: 'sequence' }, async (reporter) => {
      await reporter.activity('Initialize', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await reporter.activity('Configure', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    });

    await r.run(runWithReporter);
  },
});
