/**
 * Release helpers
 *
 * Pure functions backing the automated post-publish bookkeeping in
 * `commands/publish.ts`. Kept side-effect free so they can be unit tested
 * without touching the filesystem, git, or the npm registry.
 *
 * Background — the dogfooding invariant
 * -------------------------------------
 * The repo root dogfoods the *published* pok tooling: root `package.json`
 * pins `pokit` and npm-aliases `@pokit/*` to their registry versions. The
 * workspace packages must always sit a version AHEAD of those pins, otherwise
 * bun silently workspace-links the root deps to the in-progress workspace code
 * and the tooling can be broken by unreleased changes.
 *
 * These helpers make that invariant self-maintaining across a publish:
 *  - `computeRepins`      -> repin root deps to the freshly published versions
 *  - `computeAheadVersion`-> advance a just-published pkg to its next dev version
 *  - `findBrokenInvariant`-> guard: workspace version must never equal a pin
 *  - `isWorkspaceLinked`  -> detect a root dep that resolved to workspace source
 */

import semver from 'semver';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

/** Package names owned by this repo's publish surface. */
export function isPokitPackage(name: string): boolean {
  return name === 'pokit' || name === 'create-pokit' || name.startsWith('@pokit/');
}

/**
 * Resolve the real package name a root dependency spec points at.
 * Handles npm aliases (`npm:@pokit/core@0.1.0`) and plain pins (`0.0.38`).
 */
export function resolveTargetPackage(key: string, spec: string): string {
  const alias = spec.match(/^npm:(@?[^@]+(?:\/[^@]+)?)@.+$/);
  return alias ? alias[1] : key;
}

/** Extract the pinned version from a dep spec, or null if it isn't a fixed pin. */
export function resolvePinnedVersion(spec: string): string | null {
  const alias = spec.match(/^npm:@?[^@]+(?:\/[^@]+)?@(.+)$/);
  if (alias) return semver.valid(alias[1]) ? alias[1] : null;
  return semver.valid(spec) ? spec : null;
}

/** Rewrite a dep spec to a new version, preserving the alias form. */
export function repinSpec(spec: string, targetName: string, newVersion: string): string {
  if (spec.startsWith('npm:')) return `npm:${targetName}@${newVersion}`;
  return newVersion;
}

export interface Repin {
  key: string;
  from: string;
  to: string;
}

export interface RepinOutcome {
  repins: Repin[];
  /** Root-pinned @pokit deps that were NOT part of this publish. */
  warnings: string[];
}

/**
 * Compute the root package.json dependency repins for a set of freshly
 * published packages. Every @pokit-aliased / pokit-family root dep is
 * considered: repinned if it was just published, warned about otherwise.
 *
 * @param deps      merged root dependencies map (key -> spec)
 * @param published name -> freshly published version
 */
export function computeRepins(
  deps: Record<string, string>,
  published: Map<string, string>,
): RepinOutcome {
  const repins: Repin[] = [];
  const warnings: string[] = [];

  for (const [key, spec] of Object.entries(deps)) {
    const target = resolveTargetPackage(key, spec);
    if (!isPokitPackage(target)) continue;

    const version = published.get(target);
    if (version === undefined) {
      warnings.push(
        `Root dep "${key}" (-> ${target}) is pinned to ${spec} but was not part of this publish; left unchanged.`,
      );
      continue;
    }

    const to = repinSpec(spec, target, version);
    if (to !== spec) repins.push({ key, from: spec, to });
  }

  return { repins, warnings };
}

/**
 * Advance a just-published version to the next in-progress dev version,
 * keeping the workspace strictly ahead of the published/pinned version.
 *
 * Convention (consistent with the existing workspace state, e.g. published
 * 0.1.0 -> workspace 0.2.0-dev.0): bump the minor and open a `-dev.0`
 * prerelease.
 */
export function computeAheadVersion(published: string): string {
  const clean = semver.valid(published);
  if (!clean) throw new Error(`Cannot advance invalid version: "${published}"`);
  const next = semver.inc(clean, 'preminor', 'dev');
  if (!next) throw new Error(`Failed to compute ahead version for "${published}"`);
  return next;
}

export interface InvariantViolation {
  name: string;
  version: string;
}

/**
 * The invariant guard. Returns every package whose workspace version equals a
 * version currently pinned at root — publishing/linking in that state would let
 * bun workspace-link the root deps to unreleased code.
 *
 * @param workspace  name -> workspace version
 * @param rootPinned name -> pinned version (from root deps)
 */
export function findBrokenInvariant(
  workspace: Map<string, string>,
  rootPinned: Map<string, string>,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const [name, version] of workspace) {
    const pinned = rootPinned.get(name);
    if (pinned !== undefined && semver.valid(pinned) && semver.eq(pinned, version)) {
      violations.push({ name, version });
    }
  }
  return violations;
}

/**
 * True if a resolved dependency realpath points inside the repo's workspace
 * source (`<repoRoot>/packages/...`), i.e. it got workspace-linked instead of
 * resolving to the registry copy.
 */
export function isWorkspaceLinked(realpath: string, repoRoot: string): boolean {
  return realpath.startsWith(join(repoRoot, 'packages') + sep);
}

// ---------------------------------------------------------------------------
// Thin filesystem layer (package.json readers/writers used by publish.ts).
// All decision logic stays in the pure functions above; these just apply it.
// ---------------------------------------------------------------------------

type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

function writePackageJson(path: string, pkg: PackageJson): void {
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** Merged root deps map (dependencies + devDependencies). */
export function readRootDeps(rootPackageJsonPath: string): Record<string, string> {
  const pkg = readPackageJson(rootPackageJsonPath);
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

/** name -> exact pinned version for every pok-family root dep. */
export function readRootPins(rootPackageJsonPath: string): Map<string, string> {
  const pins = new Map<string, string>();
  for (const [key, spec] of Object.entries(readRootDeps(rootPackageJsonPath))) {
    const target = resolveTargetPackage(key, spec);
    if (!isPokitPackage(target)) continue;
    const version = resolvePinnedVersion(spec);
    if (version) pins.set(target, version);
  }
  return pins;
}

/** Apply computed repins to a root package.json (dependencies + devDependencies). */
export function applyRepins(rootPackageJsonPath: string, repins: Repin[]): void {
  if (repins.length === 0) return;
  const pkg = readPackageJson(rootPackageJsonPath);
  for (const repin of repins) {
    for (const section of [pkg.dependencies, pkg.devDependencies]) {
      if (section && section[repin.key] === repin.from) section[repin.key] = repin.to;
    }
  }
  writePackageJson(rootPackageJsonPath, pkg);
}

/** Rewrite the `version` field of a package.json. */
export function setPackageVersion(packageJsonPath: string, version: string): void {
  const pkg = readPackageJson(packageJsonPath);
  pkg.version = version;
  writePackageJson(packageJsonPath, pkg);
}
