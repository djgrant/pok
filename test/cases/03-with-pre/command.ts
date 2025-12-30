import { defineCommand } from '@pokjs/core';
import { mocks } from '@pokjs/test-utils';

const { alwaysPass, secondCheck } = mocks;

export const command = defineCommand({
  label: 'Command with pre-checks',
  pre: [alwaysPass, secondCheck],
  run: async (r) => {
    await r.exec('echo "Pre-checks passed, running command..."');
  },
});
