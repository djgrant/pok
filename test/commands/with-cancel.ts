import { defineCommand, CancelError } from '@pokit/core';

export const command = defineCommand({
  label: 'Cancel command',
  run: async () => {
    throw new CancelError('Cancelled from command');
  },
});
