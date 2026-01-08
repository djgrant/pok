import { z } from 'zod';
import { defineCommand, defineCheck } from '@pokit/core';
import { $ } from 'bun';

const PACKAGE_GROUPS = {
  scoped: {
    label: '@pokit/* packages (core, op, reporter-clack, etc.)',
    packages: [
      '@pokit/core',
      '@pokit/op',
      '@pokit/prompter-clack',
      '@pokit/reporter-clack',
      '@pokit/reporter-web',
      '@pokit/tabs-core',
      '@pokit/tabs-ink',
      '@pokit/tabs-opentui',
    ],
  },
  cli: {
    label: 'CLI packages (pokit, create-pokit)',
    packages: ['pokit', 'create-pokit'],
  },
} as const;

type PackageGroup = keyof typeof PACKAGE_GROUPS;

const npmLoggedIn = defineCheck({
  label: 'npm login',
  check: async () => {
    const result = await $`npm whoami`.quiet().nothrow();
    if (result.exitCode !== 0) {
      throw new Error('Not logged in to npm');
    }
  },
  remediation: ['Run: npm login'],
});

export const command = defineCommand({
  label: 'Publish packages to npm',
  pre: [npmLoggedIn],
  context: {
    packages: {
      from: 'flag',
      schema: z.enum(['scoped', 'cli']),
      description: 'Package group to publish: scoped (@pokit/*) or cli (pokit, create-pokit)',
    },
    dryRun: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Perform a dry run without actually publishing',
    },
  },
  run: async (r, ctx) => {
    const group = PACKAGE_GROUPS[ctx.context.packages as PackageGroup];
    const filterArgs = group.packages.map((pkg) => `--filter "${pkg}"`).join(' ');
    const dryRunFlag = ctx.context.dryRun ? ' --dry-run' : '';

    await r.group('Publish to npm', { layout: 'sequence' }, async (g) => {
      await g.activity('Build packages', async () => {
        await r.exec('pok build');
      });

      await g.activity(`Publish ${group.packages.length} packages`, async () => {
        const gitCheckFlag = ctx.context.dryRun ? ' --no-git-checks' : '';
        await r.exec(`pnpm ${filterArgs} publish --access public${dryRunFlag}${gitCheckFlag}`);
      });
    });

    if (ctx.context.dryRun) {
      r.reporter.info('Dry run complete. No packages were published.');
    } else {
      r.reporter.success(`Published ${group.packages.length} packages to npm`);
    }
  },
});
