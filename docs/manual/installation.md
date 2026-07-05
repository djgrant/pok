# Installation

## Prerequisites

- **Bun** >= 1.0.0 (https://bun.sh)
- **Node.js** >= 20 (for compatibility with some dependencies)

## Create a new project

```bash
bun create pokit my-cli
cd my-cli
bun install
```

This creates a project with:

- `commands/` directory with example commands
- Pre-configured `package.json` with dependencies
- TypeScript configuration

## Add to existing project

```bash
# Core framework (required)
bun add @pokit/core zod

# TTY adapters (choose what you need)
bun add @pokit/prompter-clack   # Interactive prompts
bun add @pokit/reporter-clack   # Terminal output rendering
bun add @pokit/opentui         # Tabbed terminal UI (optional)
```

## Project structure

```
my-cli/
├── commands/           # Command files (file-based routing)
│   ├── dev.ts         # mycli dev
│   ├── build.ts       # mycli build
│   └── db.migrate.ts  # mycli db migrate
├── pok                # CLI entry point
├── package.json
└── tsconfig.json
```

## CLI entry point

Create a `pok` file (or any name) as your CLI entry point:

```typescript
#!/usr/bin/env bun
import { run } from "@pokit/core";
import { createPrompter } from "@pokit/prompter-clack";
import { createReporterAdapter } from "@pokit/reporter-clack";
import { createTabsAdapter } from "@pokit/opentui";
import * as path from "path";

await run(process.argv.slice(2), {
  commandsDir: path.resolve(import.meta.dir, "commands"),
  projectRoot: path.resolve(import.meta.dir),
  appName: "mycli",
  prompter: createPrompter(),
  reporterAdapter: createReporterAdapter(),
  tabs: createTabsAdapter(),
});
```

Make it executable:

```bash
chmod +x pok
```
