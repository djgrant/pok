import { defineCommand } from '@pokit/core';
import { mocks } from '@pokit/test-utils';

const { alwaysPass, alwaysFailWithRemediation } = mocks;

export const command = defineCommand({
  label: 'Command with failing pre-check with remediation',
  pre: [alwaysPass, alwaysFailWithRemediation],
  run: async (r) => {
    await r.exec('echo "This should not be printed"');
  },
});
