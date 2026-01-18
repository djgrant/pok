import { z } from 'zod';
import { defineCommand, defineCheck } from '@pokit/core';
import { $ } from 'bun';

const SCOPED_PACKAGES = [
  '@pokit/core',
  '@pokit/op',
  '@pokit/prompter-clack',
  '@pokit/reporter-clack',
  '@pokit/reporter-web',
  '@pokit/tabs-core',
  '@pokit/tabs-ink',
  '@pokit/tabs-opentui',
] as const;

const CLI_PACKAGES = ['pokit', 'create-pokit'] as const;

const PACKAGE_GROUPS = {
  scoped: {
    label: '@pokit/* packages (config, core, op, reporter-clack, etc.)',
    packages: SCOPED_PACKAGES,
  },
  cli: {
    label: 'CLI packages (pokit, create-pokit)',
    packages: CLI_PACKAGES,
  },
  all: {
    label: 'All packages',
    packages: [...SCOPED_PACKAGES, ...CLI_PACKAGES],
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
      schema: z.enum(['scoped', 'cli', 'all']),
      description: 'Package group to publish: scoped (@pokit/*), cli (pokit, create-pokit), or all',
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
      await g.activity('Install workspace dependencies', async () => {
        await r.exec('pnpm install --frozen-lockfile');
      });

      await g.activity('Build packages', async () => {
        await r.exec('bun tsc --build');
      });

      await g.activity(`Publish ${group.packages.length} packages`, async () => {
        const gitCheckFlag = ctx.context.dryRun ? ' --no-git-checks' : '';
        // Use interactive mode to allow browser auth / OTP prompts
        await r.exec(`pnpm ${filterArgs} publish --access public${dryRunFlag}${gitCheckFlag}`, {
          interactive: !ctx.context.dryRun,
        });
      });
    });

    if (ctx.context.dryRun) {
      r.reporter.info('Dry run complete. No packages were published.');
    } else {
      r.reporter.success(`Published ${group.packages.length} packages to npm`);
    }
  },
});
