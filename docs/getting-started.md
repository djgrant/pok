# Getting Started

## Prerequisites

- **Bun** >= 1.0.0 (https://bun.sh)
- **Node.js** >= 20 (for compatibility with some dependencies)

## Installation

### Create a new project

The fastest way to get started is with the scaffolding CLI:

```bash
bun create pokit my-cli
cd my-cli
bun install
```

This creates a project with:

- `commands/` directory with example commands
- Pre-configured `package.json` with dependencies
- TypeScript configuration

### Add to existing project

```bash
# Core framework (required)
bun add @pokit/core zod

# TTY adapters (choose what you need)
bun add @pokit/prompter-clack   # Interactive prompts
bun add @pokit/reporter-clack   # Terminal output rendering
bun add @pokit/tabs-ink         # Tabbed terminal UI (optional)
```

## Project Structure

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

## CLI Entry Point

Create a `pok` file (or any name) as your CLI entry point:

```typescript
#!/usr/bin/env bun
import { run } from '@pokit/core';
import { createPrompter } from '@pokit/prompter-clack';
import { createReporterAdapter } from '@pokit/reporter-clack';
import { createTabsAdapter } from '@pokit/tabs-ink';
import * as path from 'path';

await run(process.argv.slice(2), {
  commandsDir: path.resolve(import.meta.dir, 'commands'),
  projectRoot: path.resolve(import.meta.dir),
  appName: 'mycli',
  prompter: createPrompter(),
  reporterAdapter: createReporterAdapter(),
  tabs: createTabsAdapter(), // Optional: for r.tabs()
});
```

Make it executable:

```bash
chmod +x pok
```

## Your First Command

Create `commands/hello.ts`:

```typescript
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    r.reporter.info('Hello from pok!');
  },
});
```

Run it:

```bash
./pok hello
# Or via package.json script
bun pok hello
```

## Adding Context (Flags)

Commands can accept typed flags:

```typescript
// commands/greet.ts
import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Greet someone',
  context: {
    name: {
      from: 'flag',
      schema: z.string(),
      description: 'Name to greet',
    },
    loud: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Use uppercase',
    },
  },
  run: async (r, ctx) => {
    const greeting = `Hello, ${ctx.context.name}!`;
    r.reporter.info(ctx.context.loud ? greeting.toUpperCase() : greeting);
  },
});
```

```bash
# With flags
./pok greet --name "World" --loud

# Missing required flag? pok prompts for it
./pok greet
? Enter name: World
```

## Running Shell Commands

Use the runner's `exec` method:

```typescript
// commands/build.ts
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Build project',
  run: async (r) => {
    await r.exec('bun run tsc');
    await r.exec('bun run build');
  },
});
```

## Grouped Output

Structure your output with groups and activities:

```typescript
// commands/setup.ts
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Setup development environment',
  run: async (r) => {
    await r.group('Dependencies', { layout: 'sequence' }, async (g) => {
      await g.activity('Install npm packages', () => r.exec('bun install'));
      await g.activity('Setup database', () => r.exec('bun db:setup'));
    });

    r.reporter.success('Ready to develop!');
  },
});
```

## Terminal Requirements

pok works best in modern terminals with Unicode and color support.
See [Terminal Requirements](./terminal-requirements.md) for details.

If you experience display issues, try `--plain` mode.

## Next Steps

- [Architecture](./architecture.md) - Understand how pok works
- [Commands](./concepts/commands.md) - Deep dive into command definitions
- [Tasks](./concepts/tasks.md) - Create reusable units of work
- [API Reference](./api/define-command.md) - Full API documentation
