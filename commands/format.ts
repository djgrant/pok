/**
 * Format command
 *
 * Formats code using Prettier
 */

import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Format code',
  run: async (r) => {
    await r.exec('bunx prettier --write .');
  },
});
