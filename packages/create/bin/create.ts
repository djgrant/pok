#!/usr/bin/env bun
/**
 * @pokjs/create - Scaffold a new pok project
 *
 * Usage:
 *   bun create @pokjs/create my-project
 *   bunx @pokjs/create my-project
 *
 * This is a pok app itself, using @pokjs/core for the CLI framework.
 */

import * as path from 'path';
import { runCli } from '@pokjs/core';

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
