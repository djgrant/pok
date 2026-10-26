import { definePreCommand } from '../../../src';
import { calls } from './_calls';

// Targets a command nested inside a plugin's mount.
export const pre = definePreCommand({
  label: 'Before docs build',
  run: async () => {
    calls.push('pre.run');
    return { prepared: true };
  },
});
