import { z } from 'zod';
import { defineCommand, defineCheck } from '@pokit/core';
import { $ } from 'bun';

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
    const packages = ctx.context.unscopedOnly ? UNSCOPED_PACKAGES : SCOPED_PACKAGES;
    const filterArgs = packages.map((pkg) => `--filter "${pkg}"`).join(' ');
    const dryRunFlag = ctx.context.dryRun ? ' --dry-run' : '';

    await r.group('Publish to npm', { layout: 'sequence' }, async (g) => {
      await g.activity('Build packages', async () => {
        await r.exec('pok build');
      });

      await g.activity(`Publish ${packages.length} packages`, async () => {
        const gitCheckFlag = ctx.context.dryRun ? ' --no-git-checks' : '';
        await r.exec(`pnpm ${filterArgs} publish --access public${dryRunFlag}${gitCheckFlag}`);
      });
    });

    if (ctx.context.dryRun) {
      r.reporter.info('Dry run complete. No packages were published.');
    } else {
      r.reporter.success(`Published ${packages.length} packages to npm`);
    }
  },
});
