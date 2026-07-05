import { defineConfig } from '@pokit/core';

// Zero-config surface: reporter / prompter / navigator are all omitted, so the
// `pok` launcher wires in @pokit/terminal's createTerminalUI() defaults.
//
// This package links the pok packages via workspace:* (see package.json), so it
// exercises the CURRENT in-progress workspace code. Use it as the manual-testing
// playground for UI / Navigator work.
export default defineConfig({
  commandsDir: './commands',
  appName: 'demo',
  // Surface this package's npm scripts as commands (pmScripts menu group).
  pmScripts: true,
});
