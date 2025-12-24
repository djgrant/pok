/**
 * Version command
 *
 * Bumps version for packages using npm version.
 * Usage: pok version [patch|minor|major] [--filter package-name]
 */

import { z } from 'zod';
import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Bump package versions',
  context: {
    filter: {
      from: 'flag',
      schema: z.string().optional(),
      description: 'Package name to version (e.g., @openpok/core)',
    },
  },
  run: async (r, ctx) => {
    const bump = ctx.extraArgs[0] || 'patch';
    const validBumps = [
      'patch',
      'minor',
      'major',
      'prepatch',
      'preminor',
      'premajor',
      'prerelease',
    ];

    if (!validBumps.includes(bump)) {
      throw new Error(`Invalid version bump: ${bump}. Use one of: ${validBumps.join(', ')}`);
    }

    if (ctx.context.filter) {
      // Version a specific package
      await r.exec(
        `pnpm --filter ${ctx.context.filter} exec npm version ${bump} --no-git-tag-version`
      );
    } else {
      // Version all packages
      await r.exec(`pnpm -r exec npm version ${bump} --no-git-tag-version`);
    }
  },
});
