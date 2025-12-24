import { defineCommand } from '@openpok/core';
import { alwaysPass, secondCheck } from '../../shared/mocks/checks';

export const command = defineCommand({
  label: 'Command with pre-checks',
  pre: [alwaysPass, secondCheck],
  run: async (r) => {
    await r.exec('echo "Pre-checks passed, running command..."');
  },
});
