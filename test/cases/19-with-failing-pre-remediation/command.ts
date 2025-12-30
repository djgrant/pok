import { defineCommand } from '@pokjs/core';
import { mocks } from '@pokjs/test-utils';

const { alwaysPass, alwaysFailWithRemediation } = mocks;

export const command = defineCommand({
  label: 'Command with failing pre-check with remediation',
  pre: [alwaysPass, alwaysFailWithRemediation],
  run: async (r) => {
    await r.exec('echo "This should not be printed"');
  },
});
