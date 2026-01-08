#!/usr/bin/env bun
/**
 * pokit - Global CLI launcher for pok
 *
 * This is a thin wrapper that:
 * 1. Tries to resolve @pokit/core from the current working directory
 * 2. Falls back to global @pokit/core if not found locally
 * 3. Calls runCli() to handle the actual CLI logic
 *
 * Install globally with: bun add -g pokit
 * Then run `pok` from any project with @pokit/core installed.
 *
 * For use outside a project, also install: bun add -g @pokit/core
 */

import { resolve } from 'bun';

async function main() {
  const cwd = process.cwd();
  let corePath: string;

  try {
    // Try local first
    corePath = await resolve('@pokit/core', cwd);
  } catch {
    // Fall back to global
    try {
      corePath = await resolve('@pokit/core', import.meta.dir);
    } catch {
      console.error(
        'Error: @pokit/core is not installed.\n\n' +
          'Install locally in your project:\n' +
          '  bun add @pokit/core\n\n' +
          'Or install globally:\n' +
          '  bun add -g @pokit/core\n'
      );
      process.exit(1);
    }
  }

  const { runCli } = await import(corePath);
  await runCli(process.argv.slice(2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
