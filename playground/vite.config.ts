import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Vite plugin to bundle @pokjs/core and dependencies for WebContainer.
 *
 * At build time, this plugin:
 * 1. Uses bun build to bundle @pokjs/core, reporter-clack, prompter-clack
 * 2. Bundles zod and fast-glob
 * 3. Creates a virtual module with all bundled code as a JSON object
 *
 * The bundled code is then mounted into WebContainer's filesystem.
 */
function pokBundlePlugin(): Plugin {
  const virtualModuleId = 'virtual:pok-bundle';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  let bundledFiles: Record<string, string> | null = null;

  async function buildBundle() {
    if (bundledFiles) return bundledFiles;

    const rootDir = path.resolve(__dirname, '..');
    const coreDir = path.join(rootDir, 'packages/core');
    const reporterDir = path.join(rootDir, 'packages/reporter-clack');
    const prompterDir = path.join(rootDir, 'packages/prompter-clack');

    const outDir = path.join(__dirname, '.pok-bundle');

    // Clean and create output directory
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    console.log('[pok-bundle] Building @pokjs/core bundle for WebContainer...');

    // Bundle @pokjs/core with all dependencies
    // We create a single entry file that re-exports everything
    const coreEntryContent = `
export * from '${coreDir}/src/index.ts';
export { runCli } from '${coreDir}/src/cli.ts';
`;
    const coreEntryPath = path.join(outDir, 'core-entry.ts');
    fs.writeFileSync(coreEntryPath, coreEntryContent);

    // Bundle core - use --outfile with full path (not --outdir)
    // Use CommonJS format because WebContainer's Node.js doesn't support ESM
    execSync(
      `bun build "${coreEntryPath}" --outfile "${path.join(outDir, 'core.js')}" --target node --format cjs --external zod --external fast-glob --external @pokjs/reporter-clack --external @pokjs/prompter-clack`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle reporter-clack
    execSync(
      `bun build "${reporterDir}/src/index.ts" --outfile "${path.join(outDir, 'reporter-clack.js')}" --target node --format cjs --external @pokjs/core --external zod`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle prompter-clack
    execSync(
      `bun build "${prompterDir}/src/index.ts" --outfile "${path.join(outDir, 'prompter-clack.js')}" --target node --format cjs --external @pokjs/core --external zod`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle zod
    execSync(
      `bun build "zod" --outfile "${path.join(outDir, 'zod.js')}" --target node --format cjs`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle fast-glob
    execSync(
      `bun build "fast-glob" --outfile "${path.join(outDir, 'fast-glob.js')}" --target node --format cjs`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Post-process: Convert dynamic import() to require() for WebContainer compatibility
    // WebContainer's Node.js doesn't support ESM dynamic imports
    function convertDynamicImportsToRequire(code: string): string {
      // Convert: await import("module") -> require("module")
      // Convert: import("module") -> Promise.resolve(require("module"))
      // Convert: await import(variable) -> require(variable)
      return code
        // Handle await import("...") pattern with string literals
        .replace(/await\s+import\s*\(\s*["']([^"']+)["']\s*\)/g, 'require("$1")')
        // Handle await import(variable) pattern with variables
        .replace(/await\s+import\s*\(\s*([^)"']+)\s*\)/g, 'require($1)')
        // Handle bare import("...") that returns a promise (without await)
        .replace(/(?<!await\s+)import\s*\(\s*["']([^"']+)["']\s*\)/g, 'Promise.resolve(require("$1"))')
        // Handle bare import(variable) that returns a promise (without await)
        .replace(/(?<!await\s+)import\s*\(\s*([^)"']+)\s*\)/g, 'Promise.resolve(require($1))');
    }

    // Read and post-process all bundled files
    bundledFiles = {
      'node_modules/@pokjs/core/dist/index.js': convertDynamicImportsToRequire(
        fs.readFileSync(path.join(outDir, 'core.js'), 'utf-8')
      ),
      'node_modules/@pokjs/reporter-clack/dist/index.js': convertDynamicImportsToRequire(
        fs.readFileSync(path.join(outDir, 'reporter-clack.js'), 'utf-8')
      ),
      'node_modules/@pokjs/prompter-clack/dist/index.js': convertDynamicImportsToRequire(
        fs.readFileSync(path.join(outDir, 'prompter-clack.js'), 'utf-8')
      ),
      'node_modules/zod/lib/index.js': convertDynamicImportsToRequire(
        fs.readFileSync(path.join(outDir, 'zod.js'), 'utf-8')
      ),
      'node_modules/fast-glob/out/index.js': convertDynamicImportsToRequire(
        fs.readFileSync(path.join(outDir, 'fast-glob.js'), 'utf-8')
      ),
    };

    // Create package.json files for each package
    // Use CommonJS (no "type": "module") for WebContainer compatibility
    bundledFiles['node_modules/@pokjs/core/package.json'] = JSON.stringify(
      {
        name: '@pokjs/core',
        version: '0.0.1',
        main: './dist/index.js',
        exports: { '.': './dist/index.js' },
        bin: { pok: './bin/pok.js' },
      },
      null,
      2
    );

    bundledFiles['node_modules/@pokjs/reporter-clack/package.json'] = JSON.stringify(
      {
        name: '@pokjs/reporter-clack',
        version: '0.0.1',
        main: './dist/index.js',
        exports: { '.': './dist/index.js' },
      },
      null,
      2
    );

    bundledFiles['node_modules/@pokjs/prompter-clack/package.json'] = JSON.stringify(
      {
        name: '@pokjs/prompter-clack',
        version: '0.0.1',
        main: './dist/index.js',
        exports: { '.': './dist/index.js' },
      },
      null,
      2
    );

    bundledFiles['node_modules/zod/package.json'] = JSON.stringify(
      {
        name: 'zod',
        version: '3.24.0',
        main: './lib/index.js',
        exports: { '.': './lib/index.js' },
      },
      null,
      2
    );

    // Save the original bundled fast-glob as the implementation
    bundledFiles['node_modules/fast-glob/out/impl.js'] =
      bundledFiles['node_modules/fast-glob/out/index.js'];

    // Create a wrapper that re-exports fast-glob's default as named exports
    // This is needed because bun bundles it as `module.exports = fg` but pok uses `require('fast-glob').glob(...)`
    // Use CommonJS for WebContainer compatibility
    bundledFiles['node_modules/fast-glob/out/index.js'] = `
const fg = require('./impl.js');

// Re-export the default
module.exports = fg;

// Also export named functions for compatibility
// fast-glob's main function IS the glob function
module.exports.glob = fg.glob || fg;
module.exports.globSync = fg.globSync || fg.sync;
module.exports.globStream = fg.globStream || fg.stream;
module.exports.async = fg.async || fg;
module.exports.sync = fg.sync;
module.exports.stream = fg.stream;
module.exports.generateTasks = fg.generateTasks;
module.exports.isDynamicPattern = fg.isDynamicPattern;
module.exports.escapePath = fg.escapePath;
module.exports.convertPathToPattern = fg.convertPathToPattern;
`;

    bundledFiles['node_modules/fast-glob/package.json'] = JSON.stringify(
      {
        name: 'fast-glob',
        version: '3.3.2',
        main: './out/index.js',
        exports: { '.': './out/index.js' },
      },
      null,
      2
    );

    // Create the pok CLI bin script (CommonJS)
    bundledFiles['node_modules/@pokjs/core/bin/pok.js'] = `#!/usr/bin/env node
const { runCli } = require('@pokjs/core');
runCli(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
`;

    // Create the .bin/pok script that makes \`pok\` available globally
    // In WebContainers, node_modules/.bin is automatically in PATH
    bundledFiles['node_modules/.bin/pok'] = `#!/usr/bin/env node
const { runCli } = require('@pokjs/core');
runCli(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
`;

    console.log('[pok-bundle] Bundle complete!');
    return bundledFiles;
  }

  return {
    name: 'pok-bundle',

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const files = await buildBundle();
        return `export const pokBundleFiles = ${JSON.stringify(files)};`;
      }
    },

    // Build the bundle during development too
    async buildStart() {
      await buildBundle();
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [pokBundlePlugin(), react()],
  server: {
    headers: {
      // Required headers for WebContainers
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  // For production builds, these headers need to be set by the hosting provider
  // Vercel/Netlify can use their respective config files
});
