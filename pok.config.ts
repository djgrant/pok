import { defineConfig } from '@pokit/core';

// UI surfaces (reporter/prompter/navigator) are omitted: the pok launcher
// wires in @pokit/terminal's createTerminalUI() by default.
export default defineConfig({
  commandsDir: './commands',
  appName: 'pok',
  pmScripts: ['quick-check'],
  pmCommands: ['repo'],
});
