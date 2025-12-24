/**
 * Lint command
 *
 * Runs ESLint across the codebase
 */

import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Run linter',
  run: async (r) => {
    // Check if eslint is available, otherwise skip
    await r.exec('bunx eslint . --max-warnings 0');
  },
});
