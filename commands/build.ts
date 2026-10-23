/**
 * Build command
 *
 * Builds all packages using TypeScript's project references
 */

import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Build packages',
  run: async (r) => {
    await r.exec('bun tsc --build');
    // Give core's dist imports .js/.d.ts extensions so Node ESM consumers resolve them.
    await r.exec('node packages/core/scripts/fix-dist-imports.mjs');
  },
});
