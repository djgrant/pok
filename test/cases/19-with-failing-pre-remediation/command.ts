import { defineCommand } from '@openpok/core';
import { alwaysPass, alwaysFailWithRemediation } from '../../shared/mocks/checks';

export const command = defineCommand({
  label: 'Command with failing pre-check with remediation',
  pre: [alwaysPass, alwaysFailWithRemediation],
  run: async (r) => {
    await r.exec('echo "This should not be printed"');
  },
});
