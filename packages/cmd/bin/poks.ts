#!/usr/bin/env bun
import { resolve } from 'bun';
import * as fs from 'fs';
import * as path from 'path';

main().catch((err: unknown) => {
  if (err && typeof err === 'object' && 'exitCode' in err) {
    const code = Number((err as { exitCode?: unknown }).exitCode);
    process.exit(Number.isFinite(code) ? code : 1);
  }
  console.error(err);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);

  const processCwd = process.cwd();
  const configResult = findConfigFileSimple(processCwd);

  let appName: string;
  let configDir: string;
  let config: any;

  if (configResult) {
    configDir = configResult.configDir;
    try {
      const rawConfig = await import(configResult.configPath);
      config = rawConfig.default;
      appName = config?.appName ?? path.basename(configDir);
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

  let p = config?.prompter;
  if (!p) {
    const terminal = await resolveModule('@pokit/terminal', configDir);
    if (!terminal || typeof terminal.createTerminalUI !== 'function') {
      console.error('Error: @pokit/terminal is required to select a command from history.');
      process.exit(1);
    }
    p = terminal.createTerminalUI({ theme: config?.theme }).prompter;
  }

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

  const { spawnSync } = await import('child_process');
  const result = spawnSync('pok', rerunArgs, {
    stdio: 'inherit',
    cwd: processCwd,
  });

  if (result.error) {
    console.error(`Error: Failed to run pok: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
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
