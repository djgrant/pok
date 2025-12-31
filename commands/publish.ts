/**
 * Publish command
 *
 * Publishes packages to npm.
 * Usage: pok publish [--dry-run]
 *
 * By default, publishes scoped @pokit/* packages together.
 * Use --unscoped-only to publish unscoped packages (pokit, create-pokit) independently.
 */

import { z } from 'zod';
import { defineCommand } from '@pokit/core';

// Scoped @pokit/* packages - published together
const SCOPED_PACKAGES = [
  '@pokit/core',
  '@pokit/op',
  '@pokit/prompter-clack',
  '@pokit/reporter-clack',
  '@pokit/reporter-web',
  '@pokit/tabs-core',
  '@pokit/tabs-ink',
  '@pokit/tabs-opentui',
];

// Unscoped packages - published independently
const UNSCOPED_PACKAGES = ['pokit', 'create-pokit'];

export const command = defineCommand({
  label: 'Publish packages to npm',
  context: {
    unscopedOnly: {
      from: 'flag',
      flag: 'unscoped-only',
      schema: z.boolean().optional(),
      description: 'Publish unscoped packages only (pokit, create-pokit) - versioned independently',
    },
    dryRun: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Perform a dry run without actually publishing',
    },
  },
  run: async (r, ctx) => {
    const dryRunFlag = ctx.context.dryRun ? ' --dry-run' : '';

    if (ctx.context.unscopedOnly) {
      // Publish unscoped packages only
      const filterArgs = UNSCOPED_PACKAGES.map((pkg) => `--filter "${pkg}"`).join(' ');
      await r.exec(`pnpm ${filterArgs} publish --access public${dryRunFlag}`);
    } else {
      // Publish scoped @pokit/* packages
      const filterArgs = SCOPED_PACKAGES.map((pkg) => `--filter "${pkg}"`).join(' ');
      await r.exec(`pnpm ${filterArgs} publish --access public${dryRunFlag}`);
    }
  },
});
