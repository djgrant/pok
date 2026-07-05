import { defineCommand } from '@pokit/core';

// Simplest possible command: no context, just runs.
export const command = defineCommand({
  label: 'Say hello',
  description: 'A minimal command with no inputs',
  run: async (r) => {
    await r.exec('echo "Hello from the pok demo playground!"');
  },
});
