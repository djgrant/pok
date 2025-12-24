/**
 * Template generators for scaffolding
 */

export type ProjectConfig = {
  name: string;
  plugins: string[];
};

export function generatePackageJson(config: ProjectConfig): string {
  const deps: Record<string, string> = {
    '@openpok/core': 'latest',
  };

  // Add selected plugins
  for (const plugin of config.plugins) {
    deps[plugin] = 'latest';
  }

  const pkg = {
    name: config.name,
    version: '0.0.1',
    type: 'module',
    scripts: {
      pok: 'bun pok',
    },
    dependencies: deps,
    devDependencies: {
      '@types/bun': 'latest',
    },
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}

export function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'bundler',
      types: ['bun'],
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ['commands/**/*', 'src/**/*'],
  };

  return JSON.stringify(config, null, 2) + '\n';
}

export function generateExampleCommand(): string {
  return `/**
 * Example command
 *
 * Run with: pok hello
 */

import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    r.reporter.info('Hello from pok!');
  },
});
`;
}

export function generateBuildCommand(): string {
  return `/**
 * Build command
 */

import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Build project',
  run: async (r) => {
    await r.exec('bun tsc --noEmit');
  },
});
`;
}

export function generateGitignore(): string {
  return `node_modules/
dist/
.DS_Store
`;
}
