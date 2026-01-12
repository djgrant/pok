/**
 * pok init command
 *
 * Scaffolds a basic pok.config.ts file for new projects.
 */

import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILENAME = 'pok.config.ts';

const CONFIG_TEMPLATE = `import { defineConfig } from 'pokit'

export default defineConfig({
  commandsDir: './commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
})
`;

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

  // Write the config file
  fs.writeFileSync(configPath, CONFIG_TEMPLATE);

  console.log(`Created pok.config.ts

Next steps:
  1. Create a commands/ directory
  2. Add your first command file
  3. Run \`pok\` to see available commands`);
}
