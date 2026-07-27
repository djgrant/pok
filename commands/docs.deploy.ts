/**
 * Docs deploy command
 *
 * Builds the documentation site and deploys it to Cloudflare Workers.
 *
 * Deployment config is inline in the site's vite.config.ts, so wrangler picks
 * up the emitted .wrangler/deploy/config.json — there is no wrangler.toml.
 */

import { defineCommand } from '@pokit/core';
import { DOCS_SITE_DIR } from './lib/docs-site';

export const command = defineCommand({
  label: 'Build and deploy to Cloudflare',
  run: async (r) => {
    await r.exec('pnpm exec docs deploy', { cwd: DOCS_SITE_DIR });
    r.reporter.success('Deployed pok-docs');
  },
});
