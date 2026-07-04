import { defineConfig } from 'vitepress';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  title: 'pok',
  description:
    'A file-based CLI framework for building beautiful command-line interfaces with TypeScript',

  // Use docs directory as source
  srcDir: '../docs',

  // Output directory for build
  outDir: './dist',

  // Base URL for GitHub Pages (adjust if using custom domain)
  base: '/openpok/',

  // Clean URLs without .html extension
  cleanUrls: true,

  // Vite configuration for proper module resolution
  vite: {
    resolve: {
      alias: {
        vue: fileURLToPath(new URL('../node_modules/vue', import.meta.url)),
      },
    },
  },

  // Theme configuration
  themeConfig: {
    // Logo and site title
    siteTitle: 'pok',

    // Navigation bar
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api/define-command' },
      { text: 'Packages', link: '/packages/core' },
      {
        text: 'GitHub',
        link: 'https://github.com/djgrant/pok',
      },
    ],

    // Sidebar navigation
    sidebar: {
      '/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Architecture', link: '/architecture' },
            { text: 'Terminal Requirements', link: '/terminal-requirements' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Commands', link: '/concepts/commands' },
            { text: 'Tasks', link: '/concepts/tasks' },
            { text: 'Environments', link: '/concepts/environments' },
            { text: 'Pre-flight Checks', link: '/concepts/checks' },
            { text: 'Events', link: '/concepts/events' },
            { text: 'Dry Run', link: '/concepts/dry-run' },
          ],
        },
        {
          text: 'API Reference',
          items: [
            { text: 'defineCommand', link: '/api/define-command' },
            { text: 'defineTask', link: '/api/define-task' },
            { text: 'defineEnv', link: '/api/define-env' },
            { text: 'defineCheck', link: '/api/define-check' },
            { text: 'Runner', link: '/api/runner' },
            { text: 'Router', link: '/api/router' },
            { text: 'Events', link: '/api/events' },
            { text: 'Prompter', link: '/api/prompter' },
            { text: 'Tabs', link: '/api/tabs' },
            { text: 'Completion', link: '/api/completion' },
          ],
        },
        {
          text: 'Packages',
          items: [
            { text: '@pokjs/core', link: '/packages/core' },
            { text: '@pokjs/create', link: '/packages/create' },
            { text: '@pokjs/prompter-clack', link: '/packages/prompter-clack' },
            { text: '@pokjs/reporter-clack', link: '/packages/reporter-clack' },
            { text: '@pokjs/tabs-core', link: '/packages/tabs-core' },
            { text: '@pokjs/tabs-ink', link: '/packages/tabs-ink' },
          ],
        },
      ],
    },

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/djgrant/pok' }],

    // Search
    search: {
      provider: 'local',
    },

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Notation',
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/djgrant/pok/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },

  // Markdown configuration
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },

  // Head tags
  head: [
    ['meta', { name: 'theme-color', content: '#646cff' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'pok - File-based CLI Framework' }],
    [
      'meta',
      {
        name: 'og:description',
        content:
          'A file-based CLI framework for building beautiful command-line interfaces with TypeScript',
      },
    ],
  ],
});
