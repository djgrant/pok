/**
 * Version command
 *
 * Bumps version using bumpp with interactive prompts, git integration, and monorepo support.
 * Usage: pok version [release-type]
 *
 * Bumpp handles everything interactively - this is a minimal wrapper.
 */

import { z } from 'zod';
import { defineCommand } from '@pokit/core';
import { versionBump } from 'bumpp';

export const command = defineCommand({
  label: 'Bump package versions',
  context: {
    recursive: {
      from: 'flag',
      flag: 'r',
      schema: z.boolean().optional(),
      description: 'Bump all packages in the monorepo',
    },
    noPush: {
      from: 'flag',
      flag: 'no-push',
      schema: z.boolean().optional(),
      description: 'Skip pushing to remote',
    },
  },
  run: async (_r, ctx) => {
    const release = ctx.extraArgs[0] || 'prompt';

    await versionBump({
      release,
      recursive: ctx.context.recursive,
      push: !ctx.context.noPush,
    });
  },
});
