/**
 * Dev docs command
 *
 * Launches the documentation website
 */

import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Documentation',
  run: async (r) => {
    r.reporter.info('Starting documentation site at http://localhost:5174');
    await r.exec('bun run --cwd website dev');
  },
});
