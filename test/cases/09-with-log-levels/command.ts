import { defineCommand } from '@pokjs/core';
import { tasks } from '@pokjs/test-utils';

const { runWithAllLogLevels } = tasks;

export const command = defineCommand({
  label: 'Command with all log levels',
  run: async (r) => {
    await r.run(runWithAllLogLevels);
  },
});
