import { defineConfig } from "vite";
import { docs } from "@notation/docs";

export default defineConfig({
  plugins: [
    docs({
      title: "pok – File-based CLI framework",
      github: "https://github.com/djgrant/pok",
      favicon: { href: "/favicon-32x32.png", type: "image/svg+xml" },
      categories: ["manual", "api"],
      // The site now lives inside the docs directory it publishes, so the
      // Markdown and nav metadata sit alongside this config.
      contentDirectory: ".",
      pagesDirectory: "pages",
      logo: "./views/logo.tsx",
      version: { packageJson: "package.json", dependency: "@pokit/core" },
      deployment: {
        name: "pok-docs",
        compatibilityDate: "2025-09-24",
        compatibilityFlags: ["nodejs_compat"],
      },
    }),
  ],
});
