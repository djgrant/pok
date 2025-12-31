# @pokit/core

A file-based CLI framework with declarative command definitions, type-safe task execution, and plugin-based TTY adapters.

## Architecture

The CLI is split into modular packages:

```
packages/
├── core/               # Core framework (zero TTY dependencies)
├── prompter-clack/     # Clack-based prompts adapter
├── reporter-clack/     # Clack-based reporter adapter
├── tabs-core/          # Shared tabs state management
├── tabs-ink/           # Ink-based tabbed console
└── tabs-opentui/       # OpenTUI-based tabbed console
```

This design:

- Keeps the core lightweight (no UI deps)
- Lets consumers choose which TTY features they need
- Enables alternative TTY implementations

## Installation

```bash
# Core framework (required)
pnpm add @pokit/core

# TTY adapters (choose what you need)
pnpm add @pokit/prompter-clack   # For prompts
pnpm add @pokit/reporter-clack   # For output rendering
pnpm add @pokit/tabs-ink         # For tabbed console
```

## Quick Start

Create an entry point with TTY adapters:

```typescript
#!/usr/bin/env bun
import { run } from '@pokit/core';
import { createPrompter } from '@pokit/prompter-clack';
import { createTabsAdapter } from '@pokit/tabs-ink';
import * as path from 'path';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  await run(args, {
    commandsDir: path.resolve(import.meta.dir, 'commands'),
    projectRoot: path.resolve(import.meta.dir, '..'),
    appName: 'mycli',
    tty: createTTYAdapter(), // Required
    tabs: createTabsAdapter(), // Optional
  });
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
```

## Core Concepts

### File-Based Routing

Commands are discovered from `*.ts` files in your commands directory. Filenames use dot-notation to define command hierarchy:

```
commands/
  dev.ts                       # mycli dev
  deploy.ts                    # mycli deploy
  generate.ts                  # mycli generate (parent)
  generate.types.ts            # mycli generate types (parent)
  generate.types.cloudflare.ts # mycli generate types cloudflare
```

### Command Definition

Commands are defined using `defineCommand()`:

```typescript
import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Start development server',

  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
      description: 'Target environment',
    },
    watch: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Enable watch mode',
    },
  },

  run: async (r, ctx) => {
    // ctx.env is typed as 'dev' | 'staging' | 'prod'
    // ctx.watch is typed as boolean
    await r.exec(`vite --mode ${ctx.env}`);
  },
});
```

### Parent Commands

Commands without a `run` function become parent commands that show a submenu:

```typescript
export const command = defineCommand({
  label: 'Run code generators',
  enableRunAllChildren: 'sequential', // or 'parallel'
});
```

### Task Definition

Tasks encapsulate reusable units of work with environment requirements:

```typescript
import { z } from 'zod';
import { defineTask, defineEnv } from '@pokit/core';

const serverEnv = defineEnv({
  requiredVars: z.object({
    DATABASE_URL: z.string(),
    API_KEY: z.string(),
  }),
  requiredContext: z.object({ env: z.enum(['dev', 'staging', 'prod']) }),
  resolve: async (keys, ctx) => {
    // Fetch secrets from your secret manager
    return { DATABASE_URL: '...', API_KEY: '...' };
  },
});

export const runMigrations = defineTask({
  label: 'Run database migrations',
  env: serverEnv,
  params: z.object({ dryRun: z.boolean().optional() }),
  exec: (ctx) => `pg-schema-diff apply ${ctx.params.dryRun ? '--dry-run' : ''}`,
});

// Or with custom logic:
export const seedDatabase = defineTask({
  label: 'Seed database',
  env: serverEnv,
  run: async (r, ctx) => {
    await r.exec('psql -f seed.sql');
    console.log('Seeded with env:', ctx.envs.DATABASE_URL);
  },
});
```

### Runner API

The `run` function receives a `Runner` instance:

```typescript
run: async (r, ctx) => {
  // Execute a command
  await r.exec('vite build');

  // Run a task (resolves env vars automatically)
  await r.run(runMigrations, { dryRun: true });

  // Run commands in parallel (kill-others behavior)
  await r.parallel([
    r.exec('vite --mode dev'),
    r.exec('stripe listen --forward-to localhost:8080'),
  ]);

  // Run tasks in tabbed console (requires tabs adapter)
  await r.tabs([r.run(viteDevTask), r.run(stripeListenerTask)]);
};
```

### TTY Adapters

The framework uses a plugin system for terminal UI. TTY adapters implement the interfaces in `@pokit/core/tty`:

```typescript
interface TTYAdapter {
  logger: TTYLogger; // Logging (info, error, warn, step, etc.)
  prompts: TTYPrompts; // Interactive prompts (select, confirm)
  spinner(): TTYSpinner; // Progress indicators
}

interface TTYTabsAdapter {
  run(items: TabItem[], options: TabsOptions): Promise<void>;
}
```

**Using tabs in commands:**

```typescript
import { startViteDev, startStripeListener } from '../tasks/dev';

export const command = defineCommand({
  label: 'Start dev servers',
  async run(r) {
    // r.tabs() requires a tabs adapter in the router config
    await r.tabs([r.run(startViteDev), r.run(startStripeListener)], {
      name: 'Development',
    });
  },
});
```

If no tabs adapter is provided, `r.tabs()` throws a helpful error with installation instructions.

**Creating custom adapters:**

```typescript
import type { TTYAdapter } from '@pokit/core/tty';

const myAdapter: TTYAdapter = {
  logger: {
    intro: (msg) => console.log(`=== ${msg} ===`),
    outro: (msg) => console.log(`=== ${msg} ===`),
    info: (msg) => console.log(`ℹ ${msg}`),
    error: (msg) => console.error(`✗ ${msg}`),
    // ...
  },
  prompts: {
    select: async (opts) => {
      /* custom select UI */
    },
    confirm: async (opts) => {
      /* custom confirm UI */
    },
  },
  spinner: () => ({
    start: (msg) => {
      /* start spinner */
    },
    stop: (msg, code) => {
      /* stop spinner */
    },
  }),
};
```

### Pre-flight Checks

Define reusable checks for command prerequisites:

```typescript
import { defineCheck } from '@pokit/core';

export const dockerRunning = defineCheck({
  label: 'Docker running',
  check: async () => {
    const result = await $`docker info`.nothrow().quiet();
    if (result.exitCode !== 0) {
      throw new Error('Docker is not running. Please start Docker Desktop.');
    }
  },
});

// Use in commands:
export const command = defineCommand({
  label: 'Start dev server',
  pre: [dockerRunning],
  run: async (r) => { ... },
});
```

## API Reference

### Router

```typescript
import { run } from '@pokit/core';

await run(args, {
  commandsDir: string,   // Path to commands directory
  projectRoot: string,   // Project root for shell commands
  appName?: string,      // Name shown in interactive menu
});
```

### defineCommand

```typescript
defineCommand({
  label: string,
  context?: Record<string, ContextFieldDef>,
  pre?: CheckConfig | HookFn | Array<CheckConfig | HookFn>,
  run?: (runner: Runner, ctx: RunContext) => Promise<void> | void,
  enableRunAllChildren?: 'sequential' | 'parallel',
  timeout?: number,
});
```

### defineTask

```typescript
// Exec task - runs a shell command
defineTask({
  label: string,
  env?: Env | Env[],
  params?: ZodSchema,
  exec: string | ((ctx: TaskContext) => string),
});

// Run task - custom logic
defineTask({
  label: string,
  env?: Env | Env[],
  params?: ZodSchema,
  run: (runner: Runner, ctx: TaskContext) => Promise<T> | T,
});
```

### defineEnv

```typescript
defineEnv({
  requiredVars: ZodObject,
  requiredContext: ZodObject,
  resolve: (keys: string[], context: Context) => Promise<Record<string, string>>,
});
```

### defineCheck

```typescript
defineCheck({
  label: string,
  check: () => Promise<void> | void,  // Throw to fail
});
```

### Utilities

```typescript
// Logging
import { info, success, done, warn, error, step, dim, header, divider } from '@pokit/core';

// Prompts
import { text, secret, confirm, select, multiselect, intro, outro } from '@pokit/core';

// Shell
import { commandExists, getVersion, getPackageManager } from '@pokit/core';

// Spinner
import { task, check } from '@pokit/core';
```

### Coercion Helpers

For parsing environment variables:

```typescript
import { asInt, asBool, asList, asDate } from '@pokit/core';

const schema = z.object({
  PORT: asInt, // "8080" -> 8080
  DEBUG: asBool, // "true" -> true
  ORIGINS: asList, // "a,b,c" -> ["a", "b", "c"]
  CREATED: asDate, // ISO string -> Date
});
```

## Design Principles

1. **Interactive by default**: Required arguments without values prompt for selection
2. **Explicit is better**: Destructive operations require explicit flags
3. **File-based routing**: Commands discovered from filesystem
4. **Declarative definitions**: Configuration over code
5. **Type-safe**: Full TypeScript support with inferred types
