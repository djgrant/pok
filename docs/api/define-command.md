# defineCommand

Defines a CLI command with type-safe context, pre-flight checks, and execution logic.

## Import

```typescript
import { defineCommand } from '@pokit/core';
```

## Signature

```typescript
function defineCommand<C extends ContextDef>(config: CommandConfig<C>): CommandConfig<C>;
```

## CommandConfig

| Property               | Type                                     | Description                                             |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `label`                | `string`                                 | Human-readable label for menus and help                 |
| `aliases`              | `string[]`                               | Alternative names to invoke this command                |
| `context`              | `ContextDef`                             | Context field definitions (flags)                       |
| `pre`                  | `CheckConfig \| CheckConfig[] \| HookFn` | Pre-execution checks                                    |
| `timeout`              | `number`                                 | Default timeout for exec calls (ms). Default: 300000    |
| `run`                  | `RunFn<C>`                               | Main execution function                                 |
| `mount`                | `MountableLike`                          | Mount a dynamic subcommand tree                         |
| `enableRunAllChildren` | `'sequential' \| 'parallel'`             | Enable "run all" for parent commands                    |
| `quietRunAll`          | `boolean`                                | Capture output when running all children. Default: true |

## Context Definition

Each context field specifies where its value comes from and its schema:

```typescript
type ContextFieldDef = {
  from: 'flag'; // Currently only 'flag' is supported
  schema: z.ZodType; // Zod schema for validation
  description?: string; // Help text
};
```

### Static Context Values

You can also provide literal values (string, number, or boolean) directly in the `context` object. These are "hardcoded" values that:

1. Are **not** exposed as CLI flags.
2. Are **not** prompted for.
3. Are fully typed in the `run` function and passed to tasks.

This is useful for creating "shortcuts" or specialized commands that fix a context value (like `env`) for a set of tasks.

```typescript
export const command = defineCommand({
  label: 'Deploy Production',
  context: {
    env: 'prod', // Static value
    verbose: {
      from: 'flag',
      schema: z.boolean().default(false),
    },
  },
  run: async (r, ctx) => {
    // ctx.context.env is typed as 'prod'
    await r.run(deployTask); // deployTask's resolver receives { env: 'prod' }
  },
});
```

## Examples

### Basic Command

```typescript
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Build the project',
  run: async (r) => {
    await r.exec('npm run build');
  },
});
```

### Command with Context

```typescript
import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Deploy to environment',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']),
      description: 'Target environment',
    },
    dryRun: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Simulate without making changes',
    },
  },
  run: async (r, ctx) => {
    // ctx.context.env is typed as 'dev' | 'staging' | 'prod'
    // ctx.context.dryRun is typed as boolean

    if (ctx.context.dryRun) {
      r.reporter.info('Dry run mode');
      return;
    }

    await r.exec(`deploy --env ${ctx.context.env}`);
  },
});
```

### Command with Pre-flight Checks

```typescript
import { defineCommand, defineCheck } from '@pokit/core';

const dockerRunning = defineCheck({
  label: 'Docker running',
  check: async () => {
    // Throws if Docker is not running
  },
});

export const command = defineCommand({
  label: 'Start development',
  pre: [dockerRunning],
  run: async (r) => {
    await r.exec('docker compose up');
  },
});
```

### Dynamic Pre-flight Checks

Pre-checks can depend on the resolved context:

```typescript
export const command = defineCommand({
  label: 'Deploy',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['staging', 'prod']),
    },
  },
  pre: (ctx) => {
    // Only require confirmation for prod
    if (ctx.env === 'prod') {
      return prodConfirmation;
    }
    return [];
  },
  run: async (r, ctx) => {
    await r.exec(`deploy --env ${ctx.context.env}`);
  },
});
```

### Command with Aliases

```typescript
export const command = defineCommand({
  label: 'Deploy to environment',
  aliases: ['d', 'dep'],
  run: async (r) => {
    await r.exec('deploy');
  },
});
```

Users can run this command as `mycli deploy`, `mycli d`, or `mycli dep`.

### Parent Command

Commands without `run` are parent commands that show a submenu:

```typescript
// commands/db.ts
export const command = defineCommand({
  label: 'Database operations',
  enableRunAllChildren: 'sequential', // Adds "all" option to menu
});
```

### Mounting Sub-apps

You can mount entire command trees from other directories or sources using `mount`:

```typescript
import { defineCommand, fromDirectory } from '@pokit/core';

export const command = defineCommand({
  label: 'Admin',
  // Mounts ./admin/*.ts(x) under the admin namespace
  mount: fromDirectory(import.meta.url, './admin'),
});
```

## Run Context

The `run` function receives a `Runner` and `RunContext`:

```typescript
type RunContext<C> = {
  context: InferContext<C>; // Resolved context values
  extraArgs: string[]; // Remaining CLI arguments
  cwd: string; // Project root directory
};
```

## Type Inference

Context types are inferred from Zod schemas:

```typescript
context: {
  count: {
    from: 'flag',
    schema: z.number().int().positive(),
  },
  tags: {
    from: 'flag',
    schema: z.array(z.string()).default([]),
  },
},
run: async (r, ctx) => {
  ctx.context.count  // number
  ctx.context.tags   // string[]
}
```

## Interactive Resolution

When a required context field is missing, pok prompts for it:

- **Enums** → Select menu with options
- **Booleans** → Confirm prompt
- **Strings/Numbers** → Text input

Fields with `.default()` or `.optional()` don't prompt.

## Related

- [defineTask](./define-task.md) - Define reusable tasks
- [defineCheck](./define-check.md) - Define pre-flight checks
- [Runner](./runner.md) - Execution API
