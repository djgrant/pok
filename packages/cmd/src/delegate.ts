/**
 * Trampoline / delegation logic for the global `pok` launcher.
 *
 * The globally-installed `pok` binary is a thin trampoline: when a project ships
 * its own local `pokit` package, the global launcher re-executes that local
 * launcher (with the same argv) so the project is served entirely by the code it
 * pinned — no global/workspace launcher code leaks into the project runtime.
 *
 * This module holds the *pure* decision logic so it can be unit-tested without
 * spawning processes. The side-effecting resolution/spawn lives in bin/pok.ts.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Env flag set on the delegated child to prevent infinite recursion. */
export const DELEGATION_ENV = 'POK_DELEGATED';

/**
 * Walk up from `startDir` to find the project root: the nearest directory that
 * contains a `pok.config.ts` (or `.config/pok.config.ts`), falling back to the
 * nearest directory with a `package.json`. Returns null if neither is found.
 */
export function findProjectRoot(
  startDir: string,
  exists: (p: string) => boolean = fs.existsSync
): string | null {
  // First pass: prefer a pok.config.ts anchor.
  let dir = startDir;
  while (true) {
    if (
      exists(path.join(dir, 'pok.config.ts')) ||
      exists(path.join(dir, '.config', 'pok.config.ts'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Second pass: fall back to a package.json anchor.
  dir = startDir;
  while (true) {
    if (exists(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Pure delegation decision.
 *
 * Delegate to the local `pokit` launcher when:
 *  - we are not already a delegated child (recursion guard), AND
 *  - a local `pokit` entry was resolvable from the project, AND
 *  - that entry is a *different* installation from the currently-running one
 *    (a same-path match means the global binary already IS the local one, e.g.
 *    a workspace symlink — running it again would be a pointless re-exec).
 *
 * All paths should be realpath-normalized by the caller before comparison.
 */
export function shouldDelegate(opts: {
  delegated: boolean;
  localEntry: string | null;
  currentEntry: string;
}): boolean {
  if (opts.delegated) return false;
  if (!opts.localEntry) return false;
  if (opts.localEntry === opts.currentEntry) return false;
  return true;
}

/**
 * Capability check for terminal-default injection.
 *
 * Only wire in @pokit/terminal defaults (reporter/prompter/navigator) when the
 * project's resolved @pokit/core actually understands that surface. We detect
 * this structurally (does the module export `createMenuNavigator`?) rather than
 * by parsing a version string, so an older core that predates zero-config runs
 * with a fully-explicit config and zero terminal involvement.
 */
export function coreSupportsTerminalDefaults(core: unknown): boolean {
  return (
    !!core &&
    typeof (core as { createMenuNavigator?: unknown }).createMenuNavigator === 'function'
  );
}
