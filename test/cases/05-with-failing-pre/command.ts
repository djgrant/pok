import { defineCommand } from '@pokit/core';
import { mocks } from '@pokit/test-utils';

const { alwaysPass, alwaysFail } = mocks;

export const command = defineCommand({
  label: 'Command with failing pre-check',
  pre: [alwaysPass, alwaysFail],
  run: async (r) => {
    await r.exec('echo "This should not be printed"');
  },
});
