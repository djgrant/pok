import { defineConfig } from "vite";
import { docs } from "@notation/docs";

export default defineConfig({
  plugins: [
    docs({
      title: "pok – File-based CLI framework",
      github: "https://github.com/djgrant/pok",
      favicon: { href: "/favicon-32x32.png", type: "image/svg+xml" },
      categories: ["manual", "api"],
      // Served at notation.dev/pok rather than on its own subdomain.
      basePath: "/pok",
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
        // notation.dev itself is the notation-docs Custom Domain; routes run
        // ahead of it, so these paths reach this Worker instead.
        routes: [
          { pattern: "notation.dev/pok", zoneName: "notation.dev" },
          { pattern: "notation.dev/pok/*", zoneName: "notation.dev" },
        ],
      },
    }),
  ],
});
