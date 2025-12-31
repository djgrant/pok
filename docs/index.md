---
layout: home

hero:
  name: pok
  text: File-based CLI Framework
  tagline: Build beautiful command-line interfaces with TypeScript
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/notation-dev/openpok

features:
  - title: File-based Routing
    details: Commands are discovered from the filesystem. Just create a file and it becomes a command. Supports nested commands with dot notation.
  - title: Type-safe
    details: Full TypeScript support with Zod schema validation for arguments, flags, and context. Get autocompletion and type checking.
  - title: Interactive Prompts
    details: Automatically prompts for missing values with beautiful terminal UI. Supports text, select, multiselect, confirm, and more.
  - title: Composable Tasks
    details: Define reusable tasks with environment management. Compose complex workflows from simple building blocks.
  - title: Pre-flight Checks
    details: Validate requirements before running commands. Check dependencies, environment variables, or custom conditions.
  - title: Modular Architecture
    details: Choose only the adapters you need. Swap prompters, reporters, and UI components to match your requirements.
---

## Quick Start

```bash
# Create a new project
pnpm create pokit my-cli

# Or add to existing project
pnpm add @pokit/core
```

## Example Command

```typescript
// commands/deploy.ts
import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Deploy to environment',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['staging', 'prod']),
      description: 'Target environment',
    },
  },
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

# Or interactively - pok prompts for missing values
$ mycli deploy
? Select environment > staging / prod
```

## Documentation

- [Getting Started](./getting-started.md) - Installation and first steps
- [Architecture](./architecture.md) - How pok works
- [Commands](./concepts/commands.md) - Defining commands
- [Tasks](./concepts/tasks.md) - Reusable tasks
- [API Reference](./api/define-command.md) - Full API documentation
