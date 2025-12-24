#!/usr/bin/env bun
/**
 * @openpok/create - Scaffold a new pok project
 *
 * Usage:
 *   bun create @openpok/create my-project
 *   bunx @openpok/create my-project
 *
 * This is a pok app itself, using @openpok/core for the CLI framework.
 */

import * as path from 'path';
import { runCli } from '@openpok/core';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const packageRoot = path.resolve(__dirname, '..');
const commandsDir = path.join(packageRoot, 'commands');

runCli(process.argv.slice(2), {
  projectRoot: packageRoot,
  commandsDir,
  appName: 'create-openpok',
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
