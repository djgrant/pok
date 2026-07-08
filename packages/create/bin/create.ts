#!/usr/bin/env bun
/**
 * create-pokit - Scaffold a new pok project
 *
 * Usage:
 *   bun create pokit my-project
 *   npx create-pokit my-project
 *   bunx create-pokit my-project
 *
 * This is a pok app itself, using @pokit/core for the CLI framework.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { runCli } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

// Use fileURLToPath, not `new URL(...).pathname`: the latter leaves the path
// percent-encoded (e.g. spaces become %20), so under a path like
// "/Users/My Project/..." the commands dir would resolve to a non-existent
// "/Users/My%20Project/..." and load zero commands silently.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const commandsDir = path.join(packageRoot, 'commands');

const ui = createTerminalUI();

runCli(process.argv.slice(2), {
  projectRoot: packageRoot,
  commandsDir,
  appName: 'create-pokit',
  reporterAdapter: ui.reporter,
  prompter: ui.prompter,
  navigator: ui.navigator,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
