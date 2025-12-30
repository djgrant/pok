/**
 * Install command
 *
 * Installs dependencies using pnpm
 */

import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Install dependencies',
  run: async (r) => {
    await r.exec('pnpm install');
  },
});
