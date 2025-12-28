---
name: add-command
description: How to add a new CLI command to pok or a pok-based CLI
---

# Adding a Command

Commands in pok use file-based routing. The file path determines the command structure.

## File Naming

```
commands/
├── build.ts           # pok build
├── check.ts           # pok check (parent command)
├── check.types.ts     # pok check types
├── check.format.ts    # pok check format
└── db.migrate.ts      # pok db migrate
```

Dot notation creates subcommands. Parent commands (without `run`) show a menu of children.

## Basic Command

```typescript
import { defineCommand } from '@openpok/core';
import { z } from 'zod';

export const command = defineCommand({
  label: 'Description shown in help',
  context: {
    // Flags and arguments
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'prod']).default('dev'),
      description: 'Target environment',
    },
    name: {
      from: 'positional',
      schema: z.string(),
      description: 'Name argument',
    },
  },
  run: async (r, ctx) => {
    // r = Runner for execution
    // ctx.context = parsed flags/args
    await r.exec(`echo "Hello ${ctx.context.name}"`);
  },
});
```

## Context Sources

| Source | Description |
|--------|-------------|
| `flag` | CLI flag (`--env prod`) |
| `positional` | Positional argument |
| `env` | Environment variable |
| `resolver` | Custom resolver function |

## Runner Methods

```typescript
await r.exec('command');           // Run shell command
await r.execQuiet('command');      // Run without output
r.log.info('message');             // Log info
r.log.warn('message');             // Log warning
r.log.error('message');            // Log error
```

## Parent Commands

```typescript
export const command = defineCommand({
  label: 'Parent command',
  enableRunAllChildren: true,  // Allow running all children
  // No run function = shows menu of subcommands
});
```

## With Tasks

```typescript
import { defineCommand, defineTask } from '@openpok/core';

const buildTask = defineTask({
  label: 'Build',
  run: async (r) => {
    await r.exec('tsc');
  },
});

export const command = defineCommand({
  label: 'Build project',
  tasks: [buildTask],
  run: async (r, ctx) => {
    await ctx.tasks.buildTask(r);
  },
});
```

## With Pre-flight Checks

```typescript
import { defineCommand, defineCheck } from '@openpok/core';

const nodeCheck = defineCheck({
  label: 'Node.js installed',
  run: async () => {
    // Return true if check passes
    return commandExists('node');
  },
});

export const command = defineCommand({
  label: 'Build',
  pre: [nodeCheck],
  run: async (r, ctx) => {
    // Only runs if pre checks pass
  },
});
```
