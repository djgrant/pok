import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Simple command',
  run: async (r) => {
    await r.exec('echo "Hello from simple command"');
  },
});
