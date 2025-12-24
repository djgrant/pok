/**
 * Initialize/scaffold a new pok project
 *
 * This is the default command when running:
 *   bun create @openpok/create my-project
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'bun';
import { z } from 'zod';
import { defineCommand, type MultiselectOption, type SelectOption } from '@openpok/core';
import {
  generatePackageJson,
  generateTsConfig,
  generateExampleCommand,
  generateBuildCommand,
  generateGitignore,
} from '../src/templates';

const AVAILABLE_PLUGINS: MultiselectOption<string>[] = [
  {
    value: '@openpok/prompter-clack',
    label: 'Prompter (clack)',
    hint: 'Interactive prompts for user input',
  },
  {
    value: '@openpok/reporter-clack',
    label: 'Reporter (clack)',
    hint: 'Beautiful CLI output and spinners',
  },
];

const INSTALL_OPTIONS: SelectOption<'install' | 'skip'>[] = [
  {
    value: 'install',
    label: 'Yes, install globally',
    hint: 'bun add -g @openpok/cmd',
  },
  {
    value: 'skip',
    label: 'No, skip for now',
    hint: 'Use "bun pok" instead',
  },
];

export const command = defineCommand({
  label: 'Create a new pok project',
  context: {
    name: {
      from: 'flag',
      schema: z.string().min(1),
      description: 'Project name',
    },
  },
  run: async (r, ctx) => {
    const projectName = ctx.context.name;
    const projectPath = path.resolve(process.cwd(), projectName);

    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
      r.reporter.error(`Directory "${projectName}" already exists`);
      process.exit(1);
    }

    // Prompt for plugins (cancellation is handled by the prompter)
    const selectedPlugins = await r.prompter.multiselect({
      message: 'Select plugins to install:',
      options: AVAILABLE_PLUGINS,
      initialValues: AVAILABLE_PLUGINS.map((plugin) => plugin.value),
      required: false,
    });

    // Create project structure
    await r.group('Creating project', { layout: 'sequence' }, async (grp) => {
      // Create directory
      await grp.activity('Create project directory', async () => {
        fs.mkdirSync(projectPath, { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'commands'), { recursive: true });
      });

      // Generate files
      await grp.activity('Generate project files', async () => {
        const config = {
          name: projectName,
          plugins: selectedPlugins as string[],
        };

        // package.json
        fs.writeFileSync(
          path.join(projectPath, 'package.json'),
          generatePackageJson(config)
        );

        // tsconfig.json
        fs.writeFileSync(
          path.join(projectPath, 'tsconfig.json'),
          generateTsConfig()
        );

        // .gitignore
        fs.writeFileSync(
          path.join(projectPath, '.gitignore'),
          generateGitignore()
        );

        // Example commands
        fs.writeFileSync(
          path.join(projectPath, 'commands', 'hello.ts'),
          generateExampleCommand()
        );

        fs.writeFileSync(
          path.join(projectPath, 'commands', 'build.ts'),
          generateBuildCommand()
        );
      });

      // Install dependencies
      await grp.activity('Install dependencies', async () => {
        const proc = spawn(['bun', 'install'], {
          cwd: projectPath,
          stdio: ['inherit', 'pipe', 'pipe'],
        });
        const exitCode = await proc.exited;
        if (exitCode !== 0) {
          throw new Error(`bun install failed with exit code ${exitCode}`);
        }
      });
    });

    // Check if pok command is available globally
    let pokAvailable = false;
    try {
      const proc = spawn(['which', 'pok'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const exitCode = await proc.exited;
      pokAvailable = exitCode === 0;
    } catch {
      pokAvailable = false;
    }

    // If pok is not available globally, ask user if they want to install it
    if (!pokAvailable) {
      const installChoice = await r.prompter.select({
        message: 'Install global pok command?',
        options: INSTALL_OPTIONS,
      });

      if (installChoice === 'install') {
        await r.group(
          'Installing global CLI',
          { layout: 'sequence' },
          async (grp) => {
            await grp.activity('Install @openpok/cmd globally', async () => {
              const proc = spawn(['bun', 'add', '-g', '@openpok/cmd'], {
                stdio: ['inherit', 'pipe', 'pipe'],
              });
              const exitCode = await proc.exited;
              if (exitCode !== 0) {
                throw new Error(
                  `Global install failed with exit code ${exitCode}`
                );
              }
            });
          }
        );
        pokAvailable = true;
      }
    }

    // Show next steps
    r.reporter.success(`Project "${projectName}" created successfully!`);
    r.reporter.info('');
    r.reporter.info('Next steps:');
    r.reporter.step(`  cd ${projectName}`);
    if (pokAvailable) {
      r.reporter.step('  pok');
    } else {
      r.reporter.step('  bun pok');
      r.reporter.info('');
      r.reporter.info('To install the global pok command later:');
      r.reporter.step('  bun add -g @openpok/cmd');
    }
  },
});
