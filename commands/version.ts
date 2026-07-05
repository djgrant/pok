/**
 * Version command
 *
 * Bumps version using bumpp with interactive prompts, git integration, and monorepo support.
 * Usage: pok version [release-type]
 */

import { z } from 'zod';
import { defineCommand } from '@pokit/core';
import { versionBump } from 'bumpp';

const SCOPED_FILES = [
  'packages/core/package.json',
  'packages/op/package.json',
  'packages/terminal/package.json',
];

const CLI_FILES = ['packages/cmd/package.json', 'packages/create/package.json'];

const PACKAGE_GROUPS = {
  scoped: {
    label: '@pokit/* packages (core, op, terminal)',
    files: SCOPED_FILES,
    tag: 'v%s',
    commit: 'release: v%s',
  },
  cli: {
    label: 'CLI packages (pokit, create-pokit)',
    files: CLI_FILES,
    tag: 'cli-v%s',
    commit: 'release: cli v%s',
  },
  all: {
    label: 'All packages',
    files: [...SCOPED_FILES, ...CLI_FILES],
    tag: 'v%s',
    commit: 'release: v%s',
  },
} as const;

type PackageGroup = keyof typeof PACKAGE_GROUPS;

export const command = defineCommand({
  label: 'Bump package versions',
  context: {
    packages: {
      from: 'flag',
      schema: z.enum(['scoped', 'cli', 'all']),
      description: 'Package group to version: scoped (@pokit/*), cli (pokit, create-pokit), or all',
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
      preid: 'rc',
      confirm: !skipConfirm,
    });
  },
});
