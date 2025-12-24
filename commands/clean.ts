/**
 * Clean command
 *
 * Removes build artifacts and cached files
 */

import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Clean build artifacts',
  run: async (r) => {
    await r.exec('bun tsc --build --clean');
  },
});
