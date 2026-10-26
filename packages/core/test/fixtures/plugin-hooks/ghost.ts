import { definePostCommand } from '../../../src';

// No command exists at `ghost`: pok should warn and ignore this.
export const post = definePostCommand({
  label: 'After ghost',
  run: async () => {},
});
