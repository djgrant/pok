#!/usr/bin/env bun
import { resolve } from 'bun';
import * as fs from 'fs';
import * as path from 'path';

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);

  const processCwd = process.cwd();
  const configResult = findConfigFileSimple(processCwd);

  let appName: string;
  let configDir: string;

  if (configResult) {
    configDir = configResult.configDir;
    try {
      const rawConfig = await import(configResult.configPath);
      appName = rawConfig.default?.appName ?? path.basename(configDir);
    } catch {
      appName = path.basename(configDir);
    }
  } else {
    configDir = processCwd;
    appName = path.basename(processCwd);
  }

  const core = await resolveModule('@pokit/core', configDir);
  if (!core) {
    console.error('Error: @pokit/core is not installed.');
    process.exit(1);
  }

  const { loadHistory, formatEntryLabel, clearHistory } = core;

  if (args[0] === '--clear') {
    clearHistory(appName);
    console.log('History cleared.');
    return;
  }

  const entries = loadHistory(appName);

  if (entries.length === 0) {
    console.log('No command history yet.');
    return;
  }

  const reporter = await resolveModule('@pokit/reporter-clack', configDir);
  const prompter = await resolveModule('@pokit/prompter-clack', configDir);

  if (!reporter || !prompter) {
    console.error('Error: @pokit/reporter-clack and @pokit/prompter-clack are required.');
    process.exit(1);
  }

  const { createPrompter } = prompter;
  const p = createPrompter();

  const options = entries.map((entry: any) => ({
    value: entry,
    label: formatEntryLabel(entry),
  }));

  const choose = p.autocomplete ? p.autocomplete.bind(p) : p.select.bind(p);

  const selected: any = await choose({
    message: 'Recent commands',
    options,
  });

  if (!selected) {
    return;
  }

  const rerunArgs = [...selected.commandPath, ...selected.args];

  const { execSync } = await import('child_process');
  try {
    execSync(`pok ${rerunArgs.join(' ')}`, {
      stdio: 'inherit',
      cwd: processCwd,
    });
  } catch (err: any) {
    process.exit(err?.status ?? 1);
  }
}

function findConfigFileSimple(startDir: string): { configPath: string; configDir: string } | null {
  let dir = startDir;

  while (true) {
    const configPath = path.join(dir, 'pok.config.ts');
    if (fs.existsSync(configPath)) {
      return { configPath, configDir: dir };
    }

    const dotConfigPath = path.join(dir, '.config', 'pok.config.ts');
    if (fs.existsSync(dotConfigPath)) {
      return { configPath: dotConfigPath, configDir: dir };
    }

    const parentDir = path.dirname(dir);
    if (parentDir === dir) {
      return null;
    }
    dir = parentDir;
  }
}

async function resolveModule(name: string, configDir: string) {
  try {
    const projectModulePath = await resolve(name, configDir);
    return await import(projectModulePath);
  } catch {
    try {
      return await import(name);
    } catch {
      return null;
    }
  }
}
