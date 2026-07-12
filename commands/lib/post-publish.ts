import { readdirSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { Runner } from '@pokit/core';
import { $ } from 'bun';
import {
  applyRepins,
  computeReconcileBump,
  computeRepins,
  isPokitPackage,
  isWorkspaceLinked,
  readPackageJson,
  readRootDeps,
  readRootPins,
  setPackageVersion,
} from './release';

const PUBLISHABLE = [
  '@pokit/core',
  '@pokit/op',
  '@pokit/terminal',
  'pokit',
  'create-pokit',
] as const;

export interface ReconcileOptions {
  registry: string;
  skipPush: boolean;
  /**
   * Versions that were just published this run. npm is eventually consistent,
   * so `pok publish` passes these to poll the registry until they are fetchable
   * before repinning/installing. The standalone `pok post-publish` command omits
   * it and just reads whatever is currently latest.
   */
  waitFor?: Map<string, string>;
}

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
 * Idempotent post-publish bookkeeping. Derives everything from the registry +
 * working tree, so it is safe to run any number of times: repin root deps to the
 * latest published versions, advance workspace packages to stay strictly ahead,
 * refresh the lockfile, verify resolution, and commit. Backs both `pok publish`
 * (via `waitFor`) and the standalone `pok post-publish` recovery command.
 */
export async function reconcilePostPublish(r: Runner, opts: ReconcileOptions): Promise<void> {
  const { registry, skipPush, waitFor } = opts;
  const repoRoot = r.cwd;
  const rootPackageJsonPath = join(repoRoot, 'package.json');
  const workspacePackages = readWorkspacePackages(repoRoot);

  await r.group('Reconcile post-publish bookkeeping', { layout: 'sequence' }, async (g) => {
    if (waitFor && waitFor.size > 0) {
      await g.activity('Wait for published versions to land on the registry', async (a) => {
        const pending = new Map(waitFor);
        const maxAttempts = 30;
        const intervalMs = 2000;
        for (let attempt = 1; attempt <= maxAttempts && pending.size > 0; attempt++) {
          for (const [name, version] of [...pending]) {
            const result = await $`npm view ${name}@${version} version --registry ${registry}`
              .quiet()
              .nothrow();
            if (result.exitCode === 0 && result.stdout.toString().trim() === version) {
              a.info(`${name}@${version} is live`);
              pending.delete(name);
            }
          }
          if (pending.size > 0) await Bun.sleep(intervalMs);
        }
        if (pending.size > 0) {
          const stuck = [...pending].map(([name, version]) => `${name}@${version}`).join(', ');
          throw new Error(
            `Timed out after ${(maxAttempts * intervalMs) / 1000}s waiting for these versions to appear on ${registry}: ${stuck}`,
          );
        }
      });
    }

    // Source of truth is the registry: the latest published version of every
    // publishable package (or the just-published versions we waited for above).
    const published = new Map<string, string>();
    for (const name of PUBLISHABLE) {
      const result = await $`npm view ${name} version --registry ${registry}`.quiet().nothrow();
      const version = result.stdout.toString().trim();
      if (result.exitCode === 0 && version) published.set(name, version);
    }

    await g.activity('Repin root deps to latest published versions', async (a) => {
      const { repins, warnings } = computeRepins(readRootDeps(rootPackageJsonPath), published);
      for (const warning of warnings) a.warn(warning);
      applyRepins(rootPackageJsonPath, repins);
      if (repins.length === 0) a.info('Root deps already pinned to latest published.');
      for (const repin of repins) a.info(`${repin.key}: ${repin.from} -> ${repin.to}`);
    });

    await g.activity('Advance workspace versions past published', async (a) => {
      let bumped = 0;
      for (const [name, { dir, version }] of workspacePackages) {
        const latest = published.get(name);
        if (!latest) continue;
        const next = computeReconcileBump(version, latest);
        if (!next) continue;
        setPackageVersion(join(dir, 'package.json'), next);
        a.info(`${name}: ${version} -> ${next}`);
        bumped++;
      }
      if (bumped === 0) a.info('All workspace versions already ahead of published.');
    });

    await g.activity('Reinstall to refresh lockfile', async () => {
      await r.exec('pnpm install --reporter=silent');
    });

    await g.activity('Verify root resolves registry versions', async (a) => {
      const failures: string[] = [];
      const resolved: string[] = [];
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
          resolved.push(`${pkg.name}@${pkg.version}`);
        }
      }
      if (failures.length > 0) {
        throw new Error(
          `Root dependencies are NOT resolving to the registry:\n${failures.map((f) => `  - ${f}`).join('\n')}`,
        );
      }
      a.info(`${resolved.length} root deps resolve to registry: ${resolved.join(', ')}`);
    });

    await g.activity('Commit bookkeeping changes', async (a) => {
      await r.exec(['git', 'add', 'package.json', 'pnpm-lock.yaml', 'packages']);
      const staged = await $`git diff --cached --quiet`.nothrow();
      if (staged.exitCode === 0) {
        a.info('Nothing to commit — already reconciled.');
        return;
      }
      await r.exec([
        'git',
        'commit',
        '-m',
        'chore(release): repin root to published versions, open next dev versions',
      ]);
      if (!skipPush) await r.exec('git push');
    });
  });
}
