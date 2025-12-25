# pok Documentation

pok is a file-based CLI framework for building beautiful command-line interfaces with TypeScript.

## Overview

- **File-based routing** - Commands are discovered from the filesystem
- **Type-safe** - Full TypeScript support with Zod schema validation
- **Interactive** - Prompts for missing values, beautiful terminal output
- **Composable** - Reusable tasks with environment management
- **Modular** - Choose only the adapters you need

## Quick Links

### Getting Started

- [Installation & Quick Start](./getting-started.md)
- [Terminal Requirements](./terminal-requirements.md)

### Core Concepts

- [Architecture](./architecture.md)
- [Commands](./concepts/commands.md)
- [Tasks](./concepts/tasks.md)
- [Environment & Resolvers](./concepts/environments.md)
- [Pre-flight Checks](./concepts/checks.md)
- [Event System](./concepts/events.md)

### API Reference

- [defineCommand](./api/define-command.md)
- [defineTask](./api/define-task.md)
- [defineEnv & defineEnvResolver](./api/define-env.md)
- [defineCheck](./api/define-check.md)
- [Runner](./api/runner.md)
- [Router](./api/router.md)
- [Events & Reporter](./api/events.md)
- [Prompter](./api/prompter.md)
- [Tabs Adapter](./api/tabs.md)

### Packages

- [@openpok/core](./packages/core.md) - Core framework
- [@openpok/create](./packages/create.md) - Project scaffolding
- [@openpok/prompter-clack](./packages/prompter-clack.md) - Interactive prompts
- [@openpok/reporter-clack](./packages/reporter-clack.md) - Terminal output
- [@openpok/tabs-core](./packages/tabs-core.md) - Shared tabs logic
- [@openpok/tabs-ink](./packages/tabs-ink.md) - Tabbed terminal UI

## Example

```typescript
// commands/deploy.ts
import { z } from 'zod';
import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Deploy to environment',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['staging', 'prod']),
      description: 'Target environment',
    },
  },
  pre: [dockerRunning],
  run: async (r, ctx) => {
    await r.group('Deploy', { layout: 'sequence' }, async (g) => {
      await g.activity('Build', () => r.exec('npm run build'));
      await g.activity('Push', () => r.exec(`deploy --env ${ctx.context.env}`));
    });
  },
});
```

```bash
# Run with flag
$ mycli deploy --env staging

# Or interactively
$ mycli deploy
? Select environment › staging / prod
```
