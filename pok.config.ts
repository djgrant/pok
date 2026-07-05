import { defineConfig } from '@pokit/core';
import { createReporterAdapter } from '@pokit/reporter-clack';
import { createPrompter } from '@pokit/prompter-clack';

// DOGFOOD NOTE: this config tracks the LAST PUBLISHED release (v0.1.0) so the
// repo's own `pok` tooling can never be broken by in-progress workspace changes.
// The root deps in package.json alias @pokit/core, @pokit/reporter-clack and
// @pokit/prompter-clack to the registry (npm:@pokit/...@0.1.0), so this file is
// written against the 0.1.0 API: explicit reporter/prompter adapters rather than
// the zero-config defineConfig({}) surface.
//
// For manual UI / workspace testing use `demo/` instead (it links the workspace
// code via workspace:*).
//
// TODO: after the next publish, migrate this back to the zero-config API
// (`defineConfig({ commandsDir, appName, pmScripts })` with the terminal
// defaults wired by the launcher).
export default defineConfig({
  commandsDir: './commands',
  appName: 'pok',
  reporter: createReporterAdapter(),
  prompter: createPrompter(),
  pmScripts: ['quick-check'],
});
