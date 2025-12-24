import { defineCommand } from '@openpok/core';
import { runWithAllLogLevels } from '../../shared/tasks';

export const command = defineCommand({
  label: 'Command with all log levels',
  run: async (r) => {
    await r.run(runWithAllLogLevels);
  },
});
