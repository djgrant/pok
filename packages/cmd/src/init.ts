/**
 * pok init command
 *
 * Scaffolds a basic pok.config.ts file for new projects.
 */

import { resolve } from 'bun';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILENAME = 'pok.config.ts';

/**
 * Fallback template used when @pokit/core isn't installed yet.
 * This enables bootstrapping new projects.
 */
const FALLBACK_CONFIG_TEMPLATE = `import { defineConfig } from '@pokit/core'
import { createTerminalUI } from '@pokit/terminal'

export default defineConfig({
  ...createTerminalUI(),
})
`;

/**
 * Try to get CONFIG_TEMPLATE from @pokit/core, falling back to hardcoded template.
 */
async function getConfigTemplate(cwd: string): Promise<string> {
  try {
    const configModulePath = await resolve('@pokit/core', cwd);
    const configModule = await import(configModulePath);
    return configModule.CONFIG_TEMPLATE ?? FALLBACK_CONFIG_TEMPLATE;
  } catch {
    // @pokit/core not installed yet - use fallback for bootstrapping
    return FALLBACK_CONFIG_TEMPLATE;
  }
}

/**
 * Run the init command to create a pok.config.ts file
 */
export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, CONFIG_FILENAME);

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    console.error('Error: pok.config.ts already exists in this directory.');
    process.exit(1);
  }

  // Get the config template (from @pokit/core or fallback)
  const template = await getConfigTemplate(cwd);

  // Write the config file
  fs.writeFileSync(configPath, template);

  console.log(`Created pok.config.ts

Next steps:
  1. Create a commands/ directory
  2. Add your first command file
  3. Run \`pok\` to see available commands`);
}
