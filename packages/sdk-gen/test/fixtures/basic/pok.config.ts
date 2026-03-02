import { defineConfig, createRawReporterAdapter, createRawPrompter } from '@pokit/core';

export default defineConfig({
  appName: 'basic',
  commandsDir: './commands',
  reporter: createRawReporterAdapter(),
  prompter: createRawPrompter(),
});

