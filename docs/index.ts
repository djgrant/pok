import type { DocCategory } from "../../../packages/templates/docs";

export const categories: DocCategory[] = [
  {
    label: "User Manual",
    slug: "manual",
    sections: [
      {
        heading: "Getting Started",
        icon: "rocket",
        links: [
          { label: "Introduction", slug: "manual/introduction" },
          { label: "Installation", slug: "manual/installation" },
          { label: "Quick Start", slug: "manual/quickstart" },
        ],
      },
      {
        heading: "Commands",
        icon: "terminal",
        links: [
          { label: "Commands", slug: "manual/commands" },
          { label: "Checks", slug: "manual/checks" },
          { label: "Structured Output", slug: "manual/output" },
          { label: "Dry Run", slug: "manual/dry-run" },
        ],
      },
      {
        heading: "Tasks",
        icon: "cpu",
        links: [
          { label: "Tasks", slug: "manual/tasks" },
          { label: "Environments", slug: "manual/environments" },
        ],
      },
      {
        heading: "Execution",
        icon: "layers",
        links: [
          { label: "Global Flags", slug: "manual/global-flags" },
          { label: "Command History", slug: "manual/history" },
          { label: "Shell Completion", slug: "manual/completion" },
          { label: "Testing", slug: "manual/testing" },
        ],
      },
      {
        heading: "Guides",
        icon: "book-open",
        links: [
          { label: "Standalone CLI", slug: "manual/standalone-cli" },
          { label: "Dynamic Menus", slug: "manual/dynamic-menus" },
        ],
      },
    ],
  },
  {
    label: "API Reference",
    slug: "api",
    sections: [
      {
        heading: "Definitions",
        icon: "terminal",
        links: [
          { label: "defineCommand", slug: "api/define-command" },
          { label: "defineTask", slug: "api/define-task" },
          { label: "defineCheck", slug: "api/define-check" },
          { label: "defineEnv", slug: "api/define-env" },
        ],
      },
      {
        heading: "Execution",
        icon: "cpu",
        links: [
          { label: "Router", slug: "api/router" },
          { label: "Runner", slug: "api/runner" },
          { label: "Events", slug: "api/events" },
        ],
      },
      {
        heading: "Adapters",
        icon: "layers",
        links: [
          { label: "Prompter", slug: "api/prompter" },
          { label: "Navigator", slug: "api/navigator" },
          { label: "Completion", slug: "api/completion" },
        ],
      },
      {
        heading: "Packages",
        icon: "file-text",
        links: [
          { label: "@pokit/core", slug: "packages/core" },
          { label: "@pokit/terminal", slug: "packages/terminal" },
          { label: "create-pokit", slug: "packages/create" },
        ],
      },
    ],
  },
];
