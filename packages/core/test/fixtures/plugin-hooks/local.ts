import { defineCommand } from '../../../src';
import { calls } from './_calls';

export const command = defineCommand({
  label: 'Local command',
  run: async () => {
    calls.push('local.run');
  },
});
