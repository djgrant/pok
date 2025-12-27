import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Vite plugin to bundle @openpok/core and dependencies for WebContainer.
 *
 * At build time, this plugin:
 * 1. Uses bun build to bundle @openpok/core, reporter-clack, prompter-clack
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

    const rootDir = path.resolve(__dirname, '../..');
    const coreDir = path.join(rootDir, 'packages/core');
    const reporterDir = path.join(rootDir, 'packages/reporter-clack');
    const prompterDir = path.join(rootDir, 'packages/prompter-clack');

    const outDir = path.join(__dirname, '.pok-bundle');

    // Clean and create output directory
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    console.log('[pok-bundle] Building @openpok/core bundle for WebContainer...');

    // Bundle @openpok/core with all dependencies
    // We create a single entry file that re-exports everything
    const coreEntryContent = `
export * from '${coreDir}/src/index.ts';
export { runCli } from '${coreDir}/src/cli.ts';
`;
    const coreEntryPath = path.join(outDir, 'core-entry.ts');
    fs.writeFileSync(coreEntryPath, coreEntryContent);

    // Bundle core - use --outfile with full path (not --outdir)
    execSync(
      `bun build "${coreEntryPath}" --outfile "${path.join(outDir, 'core.js')}" --target node --format esm --external zod --external fast-glob --external @openpok/reporter-clack --external @openpok/prompter-clack`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle reporter-clack
    execSync(
      `bun build "${reporterDir}/src/index.ts" --outfile "${path.join(outDir, 'reporter-clack.js')}" --target node --format esm --external @openpok/core --external zod`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle prompter-clack
    execSync(
      `bun build "${prompterDir}/src/index.ts" --outfile "${path.join(outDir, 'prompter-clack.js')}" --target node --format esm --external @openpok/core --external zod`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle zod
    execSync(
      `bun build "zod" --outfile "${path.join(outDir, 'zod.js')}" --target node --format esm`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Bundle fast-glob
    execSync(
      `bun build "fast-glob" --outfile "${path.join(outDir, 'fast-glob.js')}" --target node --format esm`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Read all bundled files
    bundledFiles = {
      'node_modules/@openpok/core/dist/index.js': fs.readFileSync(
        path.join(outDir, 'core.js'),
        'utf-8'
      ),
      'node_modules/@openpok/reporter-clack/dist/index.js': fs.readFileSync(
        path.join(outDir, 'reporter-clack.js'),
        'utf-8'
      ),
      'node_modules/@openpok/prompter-clack/dist/index.js': fs.readFileSync(
        path.join(outDir, 'prompter-clack.js'),
        'utf-8'
      ),
      'node_modules/zod/lib/index.mjs': fs.readFileSync(path.join(outDir, 'zod.js'), 'utf-8'),
      'node_modules/fast-glob/out/index.js': fs.readFileSync(
        path.join(outDir, 'fast-glob.js'),
        'utf-8'
      ),
    };

    // Create package.json files for each package
    bundledFiles['node_modules/@openpok/core/package.json'] = JSON.stringify(
      {
        name: '@openpok/core',
        version: '0.0.1',
        type: 'module',
        main: './dist/index.js',
        exports: { '.': './dist/index.js' },
        bin: { pok: './bin/pok.js' },
      },
      null,
      2
    );

    bundledFiles['node_modules/@openpok/reporter-clack/package.json'] = JSON.stringify(
      {
        name: '@openpok/reporter-clack',
        version: '0.0.1',
        type: 'module',
        main: './dist/index.js',
        exports: { '.': './dist/index.js' },
      },
      null,
      2
    );

    bundledFiles['node_modules/@openpok/prompter-clack/package.json'] = JSON.stringify(
      {
        name: '@openpok/prompter-clack',
        version: '0.0.1',
        type: 'module',
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
        type: 'module',
        main: './lib/index.mjs',
        exports: { '.': './lib/index.mjs' },
      },
      null,
      2
    );

    bundledFiles['node_modules/fast-glob/package.json'] = JSON.stringify(
      {
        name: 'fast-glob',
        version: '3.3.2',
        type: 'module',
        main: './out/index.js',
        exports: { '.': './out/index.js' },
      },
      null,
      2
    );

    // Create the pok CLI bin script
    bundledFiles['node_modules/@openpok/core/bin/pok.js'] = `#!/usr/bin/env node
import { runCli } from '../dist/index.js';
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
