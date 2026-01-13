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
import { createReporterAdapter } from '@pokit/reporter-clack';
import { createPrompter } from '@pokit/prompter-clack';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const packageRoot = path.resolve(__dirname, '..');
const commandsDir = path.join(packageRoot, 'commands');

runCli(process.argv.slice(2), {
  projectRoot: packageRoot,
  commandsDir,
  appName: 'create-pokit',
  reporterAdapter: createReporterAdapter(),
  prompter: createPrompter(),
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
