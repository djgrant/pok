import { defineConfig } from '@pokit/core';
import { docs } from 'pok-plugins';

// DOGFOOD NOTE: this config tracks the LAST PUBLISHED release (v0.3.0) so the
// repo's own `pok` tooling can never be broken by in-progress workspace changes.
// The root deps in package.json alias @pokit/core and @pokit/terminal to the
// registry (npm:@pokit/...@0.3.0), so this file uses the zero-config surface:
// reporter / prompter / navigator are omitted and the `pok` launcher wires in
// @pokit/terminal's createTerminalUI() defaults.
//
// For manual UI / workspace testing use `demo/` instead (it links the workspace
// code via workspace:*).
export default defineConfig({
  commandsDir: './commands',
  appName: 'pok',
  pmScripts: ['quick-check'],
  // Dogfood the minimal theme preset. The installed @pokit/terminal (>=0.6.0)
  // supports it; the theme flows through once the pokit launcher >=0.3.2 is
  // installed (earlier launchers ignore it harmlessly).
  theme: { preset: 'minimal' },
  plugins: [docs({ name: 'pok-docs' })],
});
