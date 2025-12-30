/**
 * Build command
 *
 * Builds all packages using TypeScript's project references
 */

import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Build packages',
  run: async (r) => {
    await r.exec('bun tsc --build');
  },
});
