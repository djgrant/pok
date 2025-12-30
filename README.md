# pok

[![npm version](https://img.shields.io/npm/v/@pokjs/core.svg)](https://www.npmjs.com/package/@pokjs/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/notation-dev/openpok/actions/workflows/ci.yml/badge.svg)](https://github.com/notation-dev/openpok/actions/workflows/ci.yml)

A file-based CLI framework for building beautiful command-line interfaces.

## Why pok?

Building CLI tools shouldn't require wrestling with argument parsers, manually wiring up commands, or choosing between type safety and developer experience. pok takes a different approach.

### File-Based Routing

Commands are discovered from the filesystem. No registration, no configuration—just create a file:

```
commands/
  dev.ts           → mycli dev
  deploy.ts        → mycli deploy
  db.migrate.ts    → mycli db migrate
```

### Type-Safe by Default

Define your command's interface with Zod schemas. TypeScript infers everything:

```typescript
export const command = defineCommand({
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']),
    },
  },
  run: async (r, ctx) => {
    // ctx.context.env is typed as 'dev' | 'staging' | 'prod'
  },
});
```

### Interactive When You Need It

Missing a required flag? pok prompts for it. No more hunting through `--help` output:

```
$ mycli deploy
? Select environment › dev / staging / prod
```

### Beautiful Output

Structured output with spinners, progress indicators, and grouped activities—powered by adapters so you choose your UI:

```typescript
await r.group('Database Setup', async (g) => {
  await g.activity('Running migrations', async () => {
    await r.exec('prisma migrate deploy');
  });
});
```

### Parallel & Tabbed Execution

Run multiple processes side-by-side with a tabbed terminal interface:

```typescript
await r.tabs([r.exec('vite dev'), r.exec('stripe listen'), r.exec('inngest dev')]);
```

### Composable Tasks

Define reusable units of work with their own environment requirements:

```typescript
const migrate = defineTask({
  label: 'Run migrations',
  env: databaseEnv,
  exec: () => 'prisma migrate deploy',
});

// Use in any command
await r.run(migrate);
```

## Quick Start

```bash
# Create a new project
bun create @pokjs/create my-cli

# Or add to existing project
bun add @pokjs/core zod
```

## Packages

| Package                   | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `@pokjs/core`           | Core framework—command routing, task execution, event system |
| `@pokjs/cmd`            | Global CLI launcher—install once, run anywhere               |
| `@pokjs/create`         | Project scaffolding CLI                                      |
| `@pokjs/op`             | Operation utilities for common CLI patterns                  |
| `@pokjs/prompter-clack` | Interactive prompts adapter (Clack)                          |
| `@pokjs/reporter-clack` | Terminal output adapter (Clack)                              |
| `@pokjs/tabs-core`      | Shared tabs state management                                 |
| `@pokjs/tabs-ink`       | Tabbed terminal UI (Ink/React)                               |
| `@pokjs/tabs-opentui`   | Tabbed terminal UI (OpenTUI/React)                           |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api/)
- [Concepts](./docs/concepts/)

## License

MIT
