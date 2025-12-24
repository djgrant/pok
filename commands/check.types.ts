/**
 * Type check command
 *
 * Runs TypeScript type checking across all packages
 */

import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Check TypeScript types',
  run: async (r) => {
    await r.exec('bun tsc --build');
  },
});
