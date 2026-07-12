import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { defineCommand, definePostCommand } from '@pokit/core';
import { $ } from 'bun';
import {
  computeAheadVersion,
  computeRepins,
  findBrokenInvariant,
  isPokitPackage,
  readPackageJson,
  readRootDeps,
  readRootPins,
  type Repin,
} from './lib/release';
import { reconcilePostPublish } from './lib/post-publish';

const SCOPED_PACKAGES = [
  '@pokit/core',
  '@pokit/op',
  '@pokit/terminal',
] as const;

const CLI_PACKAGES = ['pokit', 'create-pokit'] as const;

const PACKAGE_GROUPS = {
  scoped: {
    label: '@pokit/* packages (core, op, terminal)',
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

/** name -> { dir, version } for every publishable pok workspace package. */
function readWorkspacePackages(repoRoot: string): Map<string, { dir: string; version: string }> {
  const result = new Map<string, { dir: string; version: string }>();
  const packagesDir = join(repoRoot, 'packages');
  for (const entry of readdirSync(packagesDir)) {
    const pkgJsonPath = join(packagesDir, entry, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = readPackageJson(pkgJsonPath);
    if (!pkg.name || !pkg.version || !isPokitPackage(pkg.name)) continue;
    result.set(pkg.name, { dir: join(packagesDir, entry), version: pkg.version });
  }
  return result;
}

/**
 * Handoff from `publish` to its post-command. `reconcile: false` marks runs
 * with nothing to reconcile (dry runs, Verdaccio publishes).
 */
const PublishOutput = z.object({
  reconcile: z.boolean(),
  registry: z.string(),
  skipPush: z.boolean(),
  published: z.record(z.string(), z.string()),
});

export const command = defineCommand({
  label: 'Publish packages',
  output: PublishOutput,
  format(data, r) {
    if (data.reconcile) {
      r.success(`Published ${Object.keys(data.published).length} packages to ${data.registry}`);
    }
  },
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
    verdaccio: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Publish to local Verdaccio (default: http://localhost:4873/) instead of npmjs',
    },
    skipPush: {
      from: 'flag',
      schema: z.boolean().optional(),
      description: 'Skip pushing the post-publish bookkeeping commit to remote',
    },
  },
  run: async (r, ctx) => {
    const group = PACKAGE_GROUPS[ctx.context.packages as PackageGroup];
    const filterArgs = group.packages.map((pkg) => `--filter "${pkg}"`).join(' ');
    const dryRunFlag = ctx.context.dryRun ? ' --dry-run' : '';
    const registry = ctx.context.verdaccio
      ? process.env.VERDACCIO_REGISTRY || 'http://localhost:4873/'
      : 'https://registry.npmjs.org/';

    const repoRoot = r.cwd;
    const rootPackageJsonPath = join(repoRoot, 'package.json');

    // --- Dogfooding invariant guard (before anything is published) ---------
    // Root package.json pins pokit/@pokit/* to published registry versions;
    // workspace packages must be strictly ahead or bun silently workspace-links
    // the root deps to unreleased code. Fail fast if that's already broken.
    const workspacePackages = readWorkspacePackages(repoRoot);
    const workspaceVersions = new Map(
      [...workspacePackages].map(([name, { version }]) => [name, version]),
    );
    const violations = findBrokenInvariant(workspaceVersions, readRootPins(rootPackageJsonPath));
    if (violations.length > 0) {
      const list = violations.map((v) => `  - ${v.name}@${v.version}`).join('\n');
      throw new Error(
        `Dogfooding invariant broken BEFORE publish: these workspace packages have the same version as the root package.json pin, so bun will workspace-link the root deps to unreleased code:\n${list}\nBump the workspace versions first (pok version) or fix the root pins.`,
      );
    }

    // Versions pnpm will publish (whatever is in each package.json right now).
    const toPublish = new Map<string, string>();
    for (const name of group.packages) {
      const pkg = workspacePackages.get(name);
      if (!pkg) throw new Error(`Workspace package not found for "${name}"`);
      toPublish.set(name, pkg.version);
    }

    const whoamiResult = await $`npm whoami --registry ${registry}`.quiet().nothrow();
    if (whoamiResult.exitCode !== 0) {
      throw new Error(`Not logged in for registry ${registry}. Run: npm login --registry ${registry}`);
    }

    await r.group(`Publish to ${registry}`, { layout: 'sequence' }, async (g) => {
      await g.activity('Install workspace dependencies', async () => {
        await r.exec('pnpm install --frozen-lockfile');
      });

      await g.activity('Build packages', async () => {
        await r.exec('bun tsc --build');
      });

      await g.activity(`Publish ${group.packages.length} packages`, async () => {
        const gitCheckFlag = ctx.context.dryRun || ctx.context.verdaccio ? ' --no-git-checks' : '';
        // Use interactive mode to allow browser auth / OTP prompts
        await r.exec(`pnpm ${filterArgs} publish --access public --registry ${registry}${dryRunFlag}${gitCheckFlag}`, {
          interactive: !ctx.context.dryRun,
        });
      });
    });

    // Plan the post-publish bookkeeping from the versions that just shipped.
    // Repins whatever pok-family deps exist at root; warns for root pins that
    // were not part of this publish (they are left untouched).
    const { repins, warnings } = computeRepins(readRootDeps(rootPackageJsonPath), toPublish);
    for (const warning of warnings) r.reporter.warn(warning);

    const handoff = {
      registry,
      skipPush: ctx.context.skipPush ?? false,
      published: Object.fromEntries(toPublish),
    };

    if (ctx.context.dryRun) {
      r.reporter.info('Dry run complete. No packages were published.');
      reportPlan(r.reporter, repins, toPublish);
      return { ...handoff, reconcile: false };
    }

    if (ctx.context.verdaccio) {
      r.reporter.success(`Published ${group.packages.length} packages to ${registry}`);
      r.reporter.info(
        'Verdaccio publish: skipping root repin / workspace bump (registry versions are local-only).',
      );
      reportPlan(r.reporter, repins, toPublish);
      return { ...handoff, reconcile: false };
    }

    return { ...handoff, reconcile: true };
  },
});

// Post-publish bookkeeping (keeps the dogfooding invariant). Runs after a
// successful publish with the handoff as typed input, and is directly
// invokable as `pok post:publish` for recovery — in which case `ctx.input` is
// undefined and the reconcile derives everything from the registry.
export const post = definePostCommand({
  label: 'Reconcile post-publish bookkeeping (idempotent)',
  input: PublishOutput.optional(),
  context: {
    verdaccio: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Reconcile against local Verdaccio instead of npmjs (direct invocation only)',
    },
    skipPush: {
      from: 'flag',
      schema: z.boolean().optional(),
      description: 'Skip pushing the bookkeeping commit to remote',
    },
  },
  run: async (r, ctx) => {
    if (ctx.input && !ctx.input.reconcile) return;

    const registry =
      ctx.input?.registry ??
      (ctx.context.verdaccio
        ? process.env.VERDACCIO_REGISTRY || 'http://localhost:4873/'
        : 'https://registry.npmjs.org/');

    // `waitFor` (npm eventual-consistency poll) only applies when versions
    // were published this run; direct invocation reads whatever is latest.
    await reconcilePostPublish(r, {
      registry,
      skipPush: ctx.input?.skipPush ?? ctx.context.skipPush ?? false,
      waitFor: ctx.input ? new Map(Object.entries(ctx.input.published)) : undefined,
    });

    r.reporter.success('Post-publish bookkeeping reconciled.');
  },
});

function reportPlan(
  reporter: { info(message: string): void },
  repins: Repin[],
  toPublish: Map<string, string>,
): void {
  reporter.info('Post-publish plan (applied automatically on a real npm publish):');
  for (const repin of repins) {
    reporter.info(`  repin ${repin.key}: ${repin.from} -> ${repin.to}`);
  }
  for (const [name, version] of toPublish) {
    reporter.info(`  bump ${name}: ${version} -> ${computeAheadVersion(version)}`);
  }
}
