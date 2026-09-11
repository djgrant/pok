import * as fs from 'fs/promises';
import * as path from 'path';
import type { CommandConfig } from '@pokit/core';
import { runInit } from './init';

type DefineCommand = (config: CommandConfig) => CommandConfig;

export const BUILTIN_COMMAND_NAMES = new Set(['init', 'skill']);

export function isBuiltinCommand(name: string | undefined): name is 'init' | 'skill' {
  return !!name && BUILTIN_COMMAND_NAMES.has(name);
}

export async function readSkill(): Promise<string> {
  const candidates = [
    path.resolve(import.meta.dir, '../SKILL.md'),
    path.resolve(import.meta.dir, '../../../SKILL.md'),
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  throw new Error('The bundled pok skill could not be found.');
}

export async function runBuiltinDirect(name: string | undefined): Promise<boolean> {
  if (name === 'init') {
    await runInit();
    return true;
  }

  if (name === 'skill') {
    process.stdout.write(await readSkill());
    return true;
  }

  return false;
}

export function createDefaultCommands(
  defineCommand: DefineCommand
): Record<string, CommandConfig> {
  return {
    init: defineCommand({
      label: 'Initialize pok',
      description: 'Create a pok.config.ts file in this project',
      run: async () => {
        await runInit();
      },
    }),
    skill: defineCommand({
      label: 'Print the pok agent skill',
      description: 'Write the pok agent skill to stdout',
      run: async () => {
        process.stdout.write(await readSkill());
      },
    }),
  };
}
