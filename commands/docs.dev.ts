/**
 * Docs dev command
 *
 * Runs the documentation site dev server.
 */

import { defineCommand } from '@pokit/core';
import { DOCS_SITE_DIR } from './lib/docs-site';

export const command = defineCommand({
  label: 'Start dev server',
  run: async (r) => {
    r.reporter.info('Starting documentation site at http://localhost:3003');
    await r.exec('pnpm exec docs dev --port 3003', { cwd: DOCS_SITE_DIR });
  },
});
