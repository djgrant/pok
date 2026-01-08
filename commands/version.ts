/**
 * Version command
 *
 * Bumps version using bumpp with interactive prompts, git integration, and monorepo support.
 * Usage: pok version [release-type]
 *
 * By default, bumps scoped @pokit/* packages together.
 * Use --unscoped-only to bump unscoped packages (pokit, create-pokit) independently.
 */

import { z } from 'zod';
import { defineCommand } from '@pokit/core';
import { versionBump } from 'bumpp';

// Scoped @pokit/* packages - bumped together
const SCOPED_PACKAGES = [
  'packages/core/package.json',
  'packages/op/package.json',
  'packages/prompter-clack/package.json',
  'packages/reporter-clack/package.json',
  'packages/reporter-web/package.json',
  'packages/tabs-core/package.json',
  'packages/tabs-ink/package.json',
  'packages/tabs-opentui/package.json',
];

// Unscoped packages (pokit, create-pokit) - bumped independently
const UNSCOPED_PACKAGES = ['packages/cmd/package.json', 'packages/create/package.json'];

export const command = defineCommand({
  label: 'Bump package versions',
  context: {
    unscopedOnly: {
      from: 'flag',
      flag: 'unscoped-only',
      schema: z.boolean().optional(),
      description: 'Bump unscoped packages only (pokit, create-pokit) - versioned independently',
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
    const skipConfirm = release !== 'prompt';

    if (ctx.context.unscopedOnly) {
      // Bump unscoped packages independently
      await versionBump({
        release,
        files: UNSCOPED_PACKAGES,
        push: !ctx.context.noPush,
        tag: 'unscoped-v%s',
        commit: 'release: unscoped packages v%s',
        preid: 'alpha',
        confirm: !skipConfirm,
      });
    } else {
      // Bump scoped @pokit/* packages
      await versionBump({
        release,
        files: SCOPED_PACKAGES,
        push: !ctx.context.noPush,
        preid: 'alpha',
        confirm: !skipConfirm,
      });
    }
  },
});
