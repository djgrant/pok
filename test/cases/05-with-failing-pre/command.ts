import { defineCommand } from '@openpok/core';
import { alwaysPass, alwaysFail } from '../../shared/mocks/checks';

export const command = defineCommand({
  label: 'Command with failing pre-check',
  pre: [alwaysPass, alwaysFail],
  run: async (r) => {
    await r.exec('echo "This should not be printed"');
  },
});
