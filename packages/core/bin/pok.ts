#!/usr/bin/env bun
/**
 * pok CLI entry point
 *
 * Thin wrapper that delegates to runCli().
 */

import { runCli } from '../src/index.ts';

runCli(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
