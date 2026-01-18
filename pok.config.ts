import { defineConfig } from '@pokit/core';
import { createReporterAdapter } from '@pokit/reporter-clack';
import { createPrompter } from '@pokit/prompter-clack';

export default defineConfig({
  commandsDir: './commands',
  reporter: createReporterAdapter(),
  prompter: createPrompter(),
  appName: 'pok',
  npmScripts: ['quick-check'],
});
