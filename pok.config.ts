/**
 * pok configuration for the pok monorepo itself
 */
import { defineConfig } from '@pokit/config';

export default defineConfig({
  commandsDir: './commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
  appName: 'pok',
});
