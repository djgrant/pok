#!/usr/bin/env bun
/**
 * pok CLI entry point (local)
 *
 * This binary is deprecated in favor of the global `pokit` CLI.
 * Use `pok` from the global pokit package instead, which handles
 * config discovery and adapter resolution.
 *
 * If you need to use this directly, you must set up the config
 * programmatically via runCli().
 */

console.error(`Error: This binary is deprecated.

Use the global 'pok' command from the 'pokit' package instead:
  bun add -g pokit

Or install locally and use via package.json scripts.
`);
process.exit(1);
