/**
 * Tutorial Content
 *
 * This file contains all the structured content for the pok interactive tutorial.
 * Content is extracted from the original learn.ts ANSI-based implementation.
 */

import type { Tutorial, TutorialSection } from './types';

// ============================================================================
// Code Templates
// ============================================================================

export const HELLO_CODE = `const { defineCommand } = require('@openpok/core');

exports.command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    r.reporter.success('Hello from pok!');
  },
});
`;

export const GREET_CODE = `const { z } = require('zod');
const { defineCommand } = require('@openpok/core');

exports.command = defineCommand({
  label: 'Greet someone',
  context: {
    name: {
      from: 'flag',
      schema: z.string().describe('Name to greet'),
    },
  },
  run: async (r, { context }) => {
    r.reporter.success(\`Hello, \${context.name}!\`);
  },
});
`;

export const DEV_CODE = `const { defineCommand } = require('@openpok/core');

exports.command = defineCommand({
  label: 'Development servers',
  run: async (r) => {
    // Open multiple processes in tabs
    await r.tabs([
      r.exec('npm run server'),
      r.exec('npm run watch'),
    ]);
  },
});
`;

export const TASK_CODE = `const { defineCommand, defineTask } = require('@openpok/core');

// Define a reusable task
const greetTask = defineTask({
  input: { name: z.string() },
  run: async (r, { input }) => {
    r.reporter.info(\`Processing: \${input.name}\`);
    return { greeted: true };
  },
});

exports.command = defineCommand({
  label: 'Use tasks',
  run: async (r) => {
    // Run the task
    const result = await r.run(greetTask, { name: 'World' });
    r.reporter.success(\`Task completed: \${result.greeted}\`);
  },
});
`;

// ============================================================================
// Tutorial Sections
// ============================================================================

const welcomeSection: TutorialSection = {
  id: 'welcome',
  title: 'Welcome to pok',
  stepNumber: 0,
  totalSteps: 5,
  steps: [
    {
      type: 'info',
      title: 'Welcome to pok',
      content:
        'pok is a framework for building beautiful CLI tools. It handles routing, validation, prompts, and multi-process terminals.\n\nThis tutorial will show you the basics.',
    },
    {
      type: 'choice',
      message: 'What would you like to learn?',
      options: [
        { value: 'create', label: 'Create your first command' },
        { value: 'args', label: 'Add flags and validation' },
        { value: 'tabs', label: 'Learn about tabs' },
        { value: 'tasks', label: 'Understand tasks' },
        { value: 'exit', label: 'Explore on your own' },
      ],
    },
  ],
};

const createCommandSection: TutorialSection = {
  id: 'create',
  title: 'Create your first command',
  stepNumber: 1,
  totalSteps: 5,
  steps: [
    {
      type: 'info',
      title: 'Commands',
      content:
        'Commands are the entry points to your CLI. Each file in commands/ becomes a command. The filename becomes the command name.',
    },
    {
      type: 'file-create',
      path: 'commands/hello.ts',
      content: HELLO_CODE,
      description: 'Creating commands/hello.ts',
    },
    {
      type: 'tip',
      content: 'The file is now visible in the sidebar. Click it to view the code.',
    },
    {
      type: 'command-run',
      command: 'pok hello',
      description: 'Running: pok hello',
      expectedOutput: 'Hello from pok!',
    },
  ],
};

const flagsValidationSection: TutorialSection = {
  id: 'args',
  title: 'Add flags and validation',
  stepNumber: 2,
  totalSteps: 5,
  steps: [
    {
      type: 'info',
      title: 'Context',
      content:
        "Context defines the inputs your command needs. Use 'from: flag' for CLI flags, or 'from: prompt' for interactive input. Zod schemas handle validation automatically.",
    },
    {
      type: 'file-create',
      path: 'commands/greet.ts',
      content: GREET_CODE,
      description: 'Creating commands/greet.ts',
    },
    {
      type: 'command-run',
      command: 'pok greet --name World',
      description: 'Running: pok greet --name World',
      expectedOutput: 'Hello, World!',
    },
    {
      type: 'tip',
      content: "Try running 'pok greet' without --name. It will prompt you!",
    },
  ],
};

const tabsSection: TutorialSection = {
  id: 'tabs',
  title: 'Learn about tabs',
  stepNumber: 3,
  totalSteps: 5,
  steps: [
    {
      type: 'info',
      title: 'Tabs',
      content:
        'Tabs let you run multiple processes side by side. Perfect for dev servers, watchers, or any concurrent workflows.',
    },
    {
      type: 'code-display',
      filename: 'commands/dev.ts',
      code: DEV_CODE,
      description: 'Example tabs command',
    },
    {
      type: 'warning',
      content:
        "Tabs require a real terminal with PTY support. They won't work in this browser-based playground, but they're powerful in a real environment!",
    },
    {
      type: 'tip',
      content: "In a real terminal, use arrow keys to switch tabs and 'q' to quit.",
    },
  ],
};

const tasksSection: TutorialSection = {
  id: 'tasks',
  title: 'Understand tasks',
  stepNumber: 4,
  totalSteps: 5,
  steps: [
    {
      type: 'info',
      title: 'Tasks',
      content:
        'Tasks are reusable units of work. They have typed inputs and outputs, can be composed together, and are perfect for complex workflows.',
    },
    {
      type: 'code-display',
      filename: 'commands/use-task.ts',
      code: TASK_CODE,
      description: 'Example task usage',
    },
    {
      type: 'tip',
      content: 'Tasks can call other tasks, enabling powerful composition patterns.',
    },
  ],
};

const exitSection: TutorialSection = {
  id: 'exit',
  title: 'Explore freely',
  stepNumber: 5,
  totalSteps: 5,
  steps: [
    {
      type: 'info',
      title: "You're ready!",
      content:
        'Your commands are in ./commands\n\nTry these:\n  pok         - see all commands\n  pok hello   - run hello command\n  pok --help  - see options',
    },
    {
      type: 'tip',
      content: 'Edit files in the sidebar and watch them update. The shell tab is a full terminal.',
    },
  ],
};

// ============================================================================
// Complete Tutorial
// ============================================================================

export const pokTutorial: Tutorial = {
  id: 'pok-basics',
  title: 'Learn pok interactively',
  description: 'An interactive tutorial that teaches the basics of pok',
  sections: [
    welcomeSection,
    createCommandSection,
    flagsValidationSection,
    tabsSection,
    tasksSection,
    exitSection,
  ],
};

/**
 * Get a section by its ID
 */
export function getSectionById(id: string): TutorialSection | undefined {
  return pokTutorial.sections.find((s) => s.id === id);
}

/**
 * Get the section index by ID
 */
export function getSectionIndexById(id: string): number {
  return pokTutorial.sections.findIndex((s) => s.id === id);
}
