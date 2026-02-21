import { defineCommand } from '@pokit/core';
import { $ } from 'bun';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

type PackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type LocalPackage = {
  name: string;
  version: string;
  packageJsonPath: string;
  repoName: string;
  repoPath: string;
  dependencies: string[];
};

type VersionParts = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

const DEFAULT_VERDACCIO = 'http://localhost:4873/';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', '.cache']);

function parseVersion(version: string): VersionParts | null {
  const match = version.trim().match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );
  if (!match) {
    return null;
  }

  const prerelease = match[4] ? match[4].split('.') : [];
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0) {
    return 1;
  }
  if (b.length === 0) {
    return -1;
  }

  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i += 1) {
    const left = a[i];
    const right = b[i];

    if (left === undefined) {
      return -1;
    }
    if (right === undefined) {
      return 1;
    }

    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);

    if (leftNumeric && rightNumeric) {
      const diff = Number(left) - Number(right);
      if (diff !== 0) {
        return diff > 0 ? 1 : -1;
      }
      continue;
    }

    if (leftNumeric && !rightNumeric) {
      return -1;
    }
    if (!leftNumeric && rightNumeric) {
      return 1;
    }

    if (left !== right) {
      return left > right ? 1 : -1;
    }
  }

  return 0;
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);

  if (!a || !b) {
    return left.localeCompare(right);
  }

  if (a.major !== b.major) {
    return a.major > b.major ? 1 : -1;
  }
  if (a.minor !== b.minor) {
    return a.minor > b.minor ? 1 : -1;
  }
  if (a.patch !== b.patch) {
    return a.patch > b.patch ? 1 : -1;
  }

  return comparePrerelease(a.prerelease, b.prerelease);
}

function readPackageJson(packageJsonPath: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  } catch {
    return null;
  }
}

function discoverRepoRoots(ecosystemRoot: string): { name: string; path: string }[] {
  const entries = readdirSync(ecosystemRoot, { withFileTypes: true });
  const repos: { name: string; path: string }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const repoPath = path.join(ecosystemRoot, entry.name);
    if (!existsSync(path.join(repoPath, '.git')) || !existsSync(path.join(repoPath, 'package.json'))) {
      continue;
    }

    repos.push({ name: entry.name, path: repoPath });
  }

  return repos;
}

function discoverPackagesInRepo(repoName: string, repoPath: string): LocalPackage[] {
  const packages: LocalPackage[] = [];
  const stack = [repoPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }

    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }

    const packageJsonPath = path.join(currentPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const pkg = readPackageJson(packageJsonPath);
    if (!pkg?.name || !pkg.version || pkg.private === true) {
      continue;
    }

    const deps = new Set<string>();
    for (const bucket of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
      if (!bucket) {
        continue;
      }
      for (const depName of Object.keys(bucket)) {
        deps.add(depName);
      }
    }

    packages.push({
      name: pkg.name,
      version: pkg.version,
      packageJsonPath,
      repoName,
      repoPath,
      dependencies: Array.from(deps),
    });
  }

  return packages;
}

async function getPublishedVersion(packageName: string, registry: string): Promise<string | null> {
  const result = await $`npm view ${packageName} version --registry ${registry}`.quiet().nothrow();
  if (result.exitCode !== 0) {
    return null;
  }

  const value = result.stdout.toString().trim();
  if (!value) {
    return null;
  }

  return value.replace(/^['"]|['"]$/g, '');
}

export const command = defineCommand({
  label: 'List repos affected by unpublished package versions',
  run: async () => {
    const registry = process.env.VERDACCIO_REGISTRY || DEFAULT_VERDACCIO;
    const ecosystemRoot = path.resolve(process.cwd(), '..');

    const repoRoots = discoverRepoRoots(ecosystemRoot);
    const allPackages = repoRoots.flatMap((repo) => discoverPackagesInRepo(repo.name, repo.path));

    const packageByName = new Map<string, LocalPackage>();
    for (const pkg of allPackages) {
      packageByName.set(pkg.name, pkg);
    }

    const reverseDeps = new Map<string, Set<string>>();
    for (const pkg of allPackages) {
      for (const depName of pkg.dependencies) {
        if (!packageByName.has(depName)) {
          continue;
        }
        if (!reverseDeps.has(depName)) {
          reverseDeps.set(depName, new Set());
        }
        reverseDeps.get(depName)?.add(pkg.name);
      }
    }

    const unpublished: Array<{
      name: string;
      localVersion: string;
      publishedVersion: string | null;
      repoName: string;
      packageJsonPath: string;
    }> = [];

    for (const pkg of allPackages) {
      const published = await getPublishedVersion(pkg.name, registry);
      if (!published || compareVersions(pkg.version, published) > 0) {
        unpublished.push({
          name: pkg.name,
          localVersion: pkg.version,
          publishedVersion: published,
          repoName: pkg.repoName,
          packageJsonPath: pkg.packageJsonPath,
        });
      }
    }

    const reasonPathsByPackage = new Map<string, Set<string>>();
    const queue: Array<{ packageName: string; pathToSeed: string[] }> = [];

    for (const seed of unpublished) {
      queue.push({ packageName: seed.name, pathToSeed: [seed.name] });
      if (!reasonPathsByPackage.has(seed.name)) {
        reasonPathsByPackage.set(seed.name, new Set());
      }
      reasonPathsByPackage.get(seed.name)?.add(seed.name);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const dependents = reverseDeps.get(current.packageName);
      if (!dependents) {
        continue;
      }

      for (const dependent of dependents) {
        const pathToSeed = [dependent, ...current.pathToSeed];
        const reason = pathToSeed.join(' -> ');
        if (!reasonPathsByPackage.has(dependent)) {
          reasonPathsByPackage.set(dependent, new Set());
        }
        const reasons = reasonPathsByPackage.get(dependent);
        if (reasons?.has(reason)) {
          continue;
        }
        reasons?.add(reason);
        queue.push({ packageName: dependent, pathToSeed });
      }
    }

    const affectedReposMap = new Map<
      string,
      { repoName: string; repoPath: string; packages: Set<string>; reasons: Set<string>; depth: number }
    >();

    for (const [packageName, reasons] of reasonPathsByPackage.entries()) {
      const pkg = packageByName.get(packageName);
      if (!pkg) {
        continue;
      }

      if (!affectedReposMap.has(pkg.repoName)) {
        affectedReposMap.set(pkg.repoName, {
          repoName: pkg.repoName,
          repoPath: pkg.repoPath,
          packages: new Set(),
          reasons: new Set(),
          depth: Number.POSITIVE_INFINITY,
        });
      }

      const entry = affectedReposMap.get(pkg.repoName);
      if (!entry) {
        continue;
      }

      entry.packages.add(packageName);
      for (const reason of reasons) {
        entry.reasons.add(reason);
        const depth = Math.max(0, reason.split(' -> ').length - 1);
        if (depth < entry.depth) {
          entry.depth = depth;
        }
      }
    }

    const affectedRepos = Array.from(affectedReposMap.values())
      .map((entry) => ({
        repoName: entry.repoName,
        repoPath: entry.repoPath,
        packages: Array.from(entry.packages).sort(),
        reasons: Array.from(entry.reasons).sort(),
        depth: Number.isFinite(entry.depth) ? entry.depth : 0,
      }))
      .sort((a, b) => a.depth - b.depth || a.repoName.localeCompare(b.repoName));

    const output = {
      registry,
      ecosystemRoot,
      unpublishedPackages: unpublished
        .map((pkg) => ({
          name: pkg.name,
          localVersion: pkg.localVersion,
          publishedVersion: pkg.publishedVersion,
          repoName: pkg.repoName,
          packageJsonPath: pkg.packageJsonPath,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      affectedRepos,
    };

    console.log(JSON.stringify(output, null, 2));
  },
});
