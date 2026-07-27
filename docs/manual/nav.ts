import type { DocCategory } from "@notation/docs/config";

export const manual: DocCategory = {
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
        { label: "Theming", slug: "manual/theming" },
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
};
