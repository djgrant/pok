import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Child command A',
  run: async (r) => {
    await r.exec('echo "Running child A"');
  },
});
