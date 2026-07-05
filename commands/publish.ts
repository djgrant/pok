import { readdirSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { defineCommand } from '@pokit/core';
import { $ } from 'bun';
import {
  applyRepins,
  computeAheadVersion,
  computeRepins,
  findBrokenInvariant,
  isPokitPackage,
  isWorkspaceLinked,
  readPackageJson,
  readRootDeps,
  readRootPins,
  setPackageVersion,
  type Repin,
} from './lib/release';

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

export const command = defineCommand({
  label: 'Publish packages',
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

    if (ctx.context.dryRun) {
      r.reporter.info('Dry run complete. No packages were published.');
      reportPlan(r.reporter, repins, toPublish);
      return;
    }

    if (ctx.context.verdaccio) {
      r.reporter.success(`Published ${group.packages.length} packages to ${registry}`);
      r.reporter.info(
        'Verdaccio publish: skipping root repin / workspace bump (registry versions are local-only).',
      );
      reportPlan(r.reporter, repins, toPublish);
      return;
    }

    // --- Post-publish bookkeeping (keeps the dogfooding invariant) ---------
    await r.group('Post-publish bookkeeping', { layout: 'sequence' }, async (g) => {
      await g.activity('Repin root deps to published versions', async (a) => {
        applyRepins(rootPackageJsonPath, repins);
        if (repins.length === 0) a.info('No root deps needed repinning.');
        for (const repin of repins) a.info(`${repin.key}: ${repin.from} -> ${repin.to}`);
      });

      await g.activity('Advance workspace versions past published', async (a) => {
        for (const [name, version] of toPublish) {
          const pkg = workspacePackages.get(name);
          if (!pkg) continue;
          const next = computeAheadVersion(version);
          setPackageVersion(join(pkg.dir, 'package.json'), next);
          a.info(`${name}: ${version} -> ${next}`);
        }
      });

      await g.activity('Reinstall to refresh lockfile', async (a) => {
        // The versions we just repinned to may not be resolvable for a few
        // seconds: npm registry propagation lags publish, so pnpm can report
        // ERR_PNPM_NO_MATCHING_VERSION ("latest release is <previous>") even
        // though the publish succeeded. Retry with backoff to ride it out.
        const maxAttempts = 6;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const result = await $`pnpm install`.cwd(repoRoot).nothrow();
          if (result.exitCode === 0) break;
          const stderr = result.stderr.toString();
          const propagationLag = stderr.includes('ERR_PNPM_NO_MATCHING_VERSION');
          if (attempt === maxAttempts || !propagationLag) {
            throw new Error(`pnpm install failed:\n${stderr}`);
          }
          a.info(
            `pnpm install could not resolve the just-published versions yet (attempt ${attempt}/${maxAttempts}); registry propagation lag, retrying...`,
          );
          await Bun.sleep(3000 * attempt);
        }
      });

      await g.activity('Verify root resolves registry versions', async (a) => {
        const failures: string[] = [];
        const pins = readRootPins(rootPackageJsonPath);
        for (const key of Object.keys(readRootDeps(rootPackageJsonPath))) {
          const depPath = join(repoRoot, 'node_modules', key);
          if (!existsSync(depPath)) continue;
          const real = realpathSync(depPath);
          const pkg = readPackageJson(join(real, 'package.json'));
          if (!pkg.name || !isPokitPackage(pkg.name)) continue;
          const pinned = pins.get(pkg.name);
          if (isWorkspaceLinked(real, repoRoot)) {
            failures.push(`${key} resolved to workspace source: ${real}`);
          } else if (pinned && pkg.version !== pinned) {
            failures.push(`${key} resolved to ${pkg.version}, expected pinned ${pinned}`);
          } else {
            a.info(`${key} -> ${pkg.name}@${pkg.version} (registry)`);
          }
        }
        if (failures.length > 0) {
          throw new Error(
            `Root dependencies are NOT resolving to the registry after repin:\n${failures.map((f) => `  - ${f}`).join('\n')}`,
          );
        }
      });

      await g.activity('Commit bookkeeping changes', async () => {
        const files = [
          'package.json',
          'pnpm-lock.yaml',
          ...[...toPublish.keys()]
            .map((name) => workspacePackages.get(name))
            .filter((pkg): pkg is { dir: string; version: string } => pkg !== undefined)
            .map((pkg) => join(pkg.dir, 'package.json')),
        ];
        await r.exec(['git', 'add', ...files]);
        await r.exec([
          'git',
          'commit',
          '-m',
          'chore(release): repin root to published versions, open next dev versions',
        ]);
        if (!ctx.context.skipPush) {
          await r.exec('git push');
        }
      });
    });

    r.reporter.success(`Published ${group.packages.length} packages to ${registry}`);
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
