/**
 * Type check command
 *
 * Runs TypeScript type checking across all packages without emitting files
 */

import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Check TypeScript types',
  run: async (r) => {
    await r.exec('bun tsc --noEmit');
  },
});
