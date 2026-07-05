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
import { runCli } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
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
