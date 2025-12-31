import { defineCommand } from '@pokit/core';
import { tasks } from '@pokit/test-utils';

const { runWithAllLogLevels } = tasks;

export const command = defineCommand({
  label: 'Command with all log levels',
  run: async (r) => {
    await r.run(runWithAllLogLevels);
  },
});
