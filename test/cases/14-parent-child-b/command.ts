import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Child command B',
  run: async (r) => {
    await r.exec('echo "Running child B"');
  },
});
