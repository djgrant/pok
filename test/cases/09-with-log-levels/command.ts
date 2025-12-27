import { defineCommand } from '@openpok/core';
import { tasks } from '@openpok/test-utils';

const { runWithAllLogLevels } = tasks;

export const command = defineCommand({
  label: 'Command with all log levels',
  run: async (r) => {
    await r.run(runWithAllLogLevels);
  },
});
