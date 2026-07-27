import type { DocCategory } from "@notation/docs/config";

export const api: DocCategory = {
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
      ],
    },
    {
      // Package reference lives under the API tab, so its Markdown sits in
      // ../packages rather than beside this file.
      heading: "Packages",
      icon: "file-text",
      links: [
        { label: "@pokit/core", slug: "packages/core" },
        { label: "@pokit/terminal", slug: "packages/terminal" },
        { label: "create-pokit", slug: "packages/create" },
      ],
    },
  ],
};
