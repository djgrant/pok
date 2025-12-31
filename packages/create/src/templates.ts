/**
 * Template generators for scaffolding
 */

import type { MultiselectOption } from '@pokit/core';

export type ProjectConfig = {
  name: string;
  plugins: string[];
};

// =============================================================================
// Template Definitions
// =============================================================================

export type Template = {
  name: string;
  label: string;
  hint: string;
  plugins: string[];
};

export const TEMPLATE_NAMES = ['starter', 'minimal', 'full', 'custom'] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const TEMPLATES: Template[] = [
  {
    name: 'starter',
    label: 'Starter (recommended)',
    hint: 'Interactive prompts + beautiful output',
    plugins: ['@pokit/prompter-clack', '@pokit/reporter-clack'],
  },
  {
    name: 'minimal',
    label: 'Minimal',
    hint: 'Core only - add adapters later',
    plugins: [],
  },
  {
    name: 'full',
    label: 'Full',
    hint: 'All plugins including tabbed UI',
    plugins: ['@pokit/prompter-clack', '@pokit/reporter-clack', '@pokit/tabs-ink'],
  },
  {
    name: 'custom',
    label: 'Custom',
    hint: 'Choose plugins individually',
    plugins: [], // Will prompt separately
  },
];

// =============================================================================
// Plugin Options (for custom template)
// =============================================================================

export const AVAILABLE_PLUGINS: MultiselectOption<string>[] = [
  {
    value: '@pokit/prompter-clack',
    label: 'Prompter (clack)',
    hint: 'Interactive prompts for user input',
  },
  {
    value: '@pokit/reporter-clack',
    label: 'Reporter (clack)',
    hint: 'Beautiful CLI output and spinners',
  },
  {
    value: '@pokit/tabs-ink',
    label: 'Tabs (ink)',
    hint: 'Tabbed UI for parallel processes',
  },
];

// =============================================================================
// File Generators
// =============================================================================

export function generatePackageJson(config: ProjectConfig): string {
  const deps: Record<string, string> = {
    '@pokit/core': 'latest',
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

import { defineCommand } from '@pokit/core';

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

import { defineCommand } from '@pokit/core';

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
