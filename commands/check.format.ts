/**
 * Format check command
 *
 * Checks if code is properly formatted using Prettier
 */

import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Check formatting',
  run: async (r) => {
    await r.exec('bunx prettier --check .');
  },
});
