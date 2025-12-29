/**
 * Dev interactive command
 *
 * Launches the interactive tutorial website
 */

import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Interactive Tutorial',
  run: async (r) => {
    r.reporter.info('Starting interactive tutorial at http://localhost:5173');
    await r.exec('bun run --cwd playground dev');
  },
});
