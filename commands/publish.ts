/**
 * Publish command
 *
 * Publishes packages to npm.
 * Usage: pok publish [--filter package-name] [--dry-run]
 */

import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Publish packages to npm',
  context: {
    filter: {
      from: 'flag',
      schema: z.string().optional(),
      description: 'Package name to publish (e.g., @pokit/core)',
    },
    dryRun: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Perform a dry run without actually publishing',
    },
  },
  run: async (r, ctx) => {
    const dryRunFlag = ctx.context.dryRun ? ' --dry-run' : '';

    if (ctx.context.filter) {
      // Publish a specific package
      await r.exec(`pnpm --filter ${ctx.context.filter} publish --access public${dryRunFlag}`);
    } else {
      // Publish all packages
      await r.exec(`pnpm -r publish --access public${dryRunFlag}`);
    }
  },
});
