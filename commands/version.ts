/**
 * Version command
 *
 * Bumps version using bumpp with interactive prompts, git integration, and monorepo support.
 * Usage: pok version [release-type]
 */

import { z } from 'zod';
import { defineCommand } from '@pokit/core';
import { versionBump } from 'bumpp';

const PACKAGE_GROUPS = {
  scoped: {
    label: '@pokit/* packages (config, core, op, reporter-clack, etc.)',
    files: [
      'packages/core/package.json',
      'packages/op/package.json',
      'packages/prompter-clack/package.json',
      'packages/reporter-clack/package.json',
      'packages/reporter-web/package.json',
      'packages/tabs-core/package.json',
      'packages/tabs-ink/package.json',
      'packages/tabs-opentui/package.json',
    ],
    tag: 'v%s',
    commit: 'release: v%s',
  },
  cli: {
    label: 'CLI packages (pokit, create-pokit)',
    files: ['packages/cmd/package.json', 'packages/create/package.json'],
    tag: 'cli-v%s',
    commit: 'release: cli v%s',
  },
} as const;

type PackageGroup = keyof typeof PACKAGE_GROUPS;

export const command = defineCommand({
  label: 'Bump package versions',
  context: {
    packages: {
      from: 'flag',
      schema: z.enum(['scoped', 'cli']),
      description: 'Package group to version: scoped (@pokit/*) or cli (pokit, create-pokit)',
    },
    skipPush: {
      from: 'flag',
      schema: z.boolean().optional(),
      description: 'Skip pushing to remote',
    },
  },
  run: async (_r, ctx) => {
    const release = ctx.extraArgs[0] || 'prompt';
    const skipConfirm = release !== 'prompt';
    const group = PACKAGE_GROUPS[ctx.context.packages as PackageGroup];

    await versionBump({
      release,
      files: [...group.files],
      push: !ctx.context.skipPush,
      tag: group.tag,
      commit: group.commit,
      preid: 'alpha',
      confirm: !skipConfirm,
    });
  },
});
