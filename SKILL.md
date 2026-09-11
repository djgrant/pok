---
name: pok
description: Build TypeScript CLI applications with pok. Use to create type-safe and re-discoverable project commands and workflows.
---

# pok

pok is a file-based CLI framework for TypeScript. Files define the command tree, Zod schemas define typed inputs, tasks package reusable work, environment resolvers supply typed configuration, and runners execute work through terminal adapters.

## Application setup

A pok application is defined by its config and command directory.

### Minimal application

Create `commands/hello.ts`, then run `pok` or `pok hello`.

### Configured application

```ts
// pok.config.ts
import { defineConfig } from '@pokit/core';

export default defineConfig({
  appName: 'acme',
  commandsDir: './cli/commands',
  pmScripts: ['test', 'build'],
});
```

You can run `pok init` to generate a minimal config.

**Full docs:** [Quick start](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/quickstart.md) · [Application configuration](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/installation.md) · [Standalone CLI](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/standalone-cli.md)

## Routing

Routing builds a nested command tree from file names and mounted plugins.

### File-based routes

```text
commands/
├── build.ts          → pok build
├── db.migrate.ts     → pok db migrate
└── db.migrate.up.ts  → pok db migrate up
```

Dots create route levels.

### Mounted routes

```ts
// commands/admin.ts
import { defineCommand, fromDirectory } from '@pokit/core';

export const command = defineCommand({
  label: 'Admin',
  mount: fromDirectory(import.meta.url, './admin'),
});
```

Files in `commands/admin/` become children of `pok admin`.

**Full docs:** [Commands: discovery and mounting](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/commands.md) · [Router API](https://raw.githubusercontent.com/djgrant/pok/main/docs/api/router.md)

## Sub-apps

A sub-app is a complete pok command tree loaded from another `pok.config.ts` file or application directory.

Use to:

- mount one pok application beneath a route in another
- compose a larger CLI from smaller applications

### Mount beneath a command

```ts
// commands/tools.ts
import { defineCommand, fromConfig } from '@pokit/core';

export const command = defineCommand({
  label: 'Tools',
  mount: fromConfig(import.meta.url, '../tools-app'),
});
```

`tools-app/commands/lint.ts` becomes `pok tools lint`.

### Mount at the application root

```ts
// pok.config.ts
import { defineConfig, fromConfig } from '@pokit/core';

export default defineConfig({
  plugins: [fromConfig(import.meta.url, '../shared-tools/pok.config.ts')],
});
```

Commands from `shared-tools` join the root command tree.

**Full docs:** [Commands: sub-app mounting](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/commands.md) · [Router API](https://raw.githubusercontent.com/djgrant/pok/main/docs/api/router.md)

## Commands

A command defines a route's label, typed inputs, checks, and execution function.

Use to:

- expose an operation through a route
- define typed inputs
- present a submenu

### Basic command

```ts
// commands/build.ts
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Build the project',
  run: (r) => r.exec('bun run build'),
});
```

### Typed inputs and passthrough arguments

```ts
// commands/deploy.ts
import { defineCommand } from '@pokit/core';
import { z } from 'zod';

export const command = defineCommand({
  label: 'Deploy a service',
  context: {
    service: { from: 'arg', schema: z.string(), description: 'Service name' },
    env: {
      from: 'flag',
      schema: z.enum(['staging', 'prod']),
      description: 'Target environment',
    },
  },
  run: (r, { context, extraArgs }) =>
    r.exec(['deploy', context.service, '--env', context.env, ...extraArgs]),
});
```

Example invocation: `pok deploy api --env staging -- --verbose`.
Required inputs prompt when absent. Defaults and optional schemas resolve directly.

**Full docs:** [Commands](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/commands.md) · [`defineCommand` API](https://raw.githubusercontent.com/djgrant/pok/main/docs/api/define-command.md)

## Tasks

A task is a reusable, typed unit of execution run from a command or another task.

Use to:

- share an operation between commands
- validate operation parameters
- resolve environments
- return typed values

### Executable task

```ts
import { defineTask } from '@pokit/core';

export const buildTask = defineTask({
  label: 'Build',
  exec: 'bun run build',
});

// Inside a command
// await r.run(buildTask);
```

### Parameterized task

```ts
import { defineTask } from '@pokit/core';
import { z } from 'zod';

export const migrateTask = defineTask({
  label: 'Migrate database',
  params: z.object({ dryRun: z.boolean().default(false) }),
  exec: ({ params }) => ['prisma', 'migrate', 'deploy', ...(params.dryRun ? ['--dry-run'] : [])],
});

// Inside a command
// await r.run(migrateTask, { dryRun: true });
```

**Full docs:** [Tasks](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/tasks.md) · [`defineTask` API](https://raw.githubusercontent.com/djgrant/pok/main/docs/api/define-task.md)

## Environments and resolvers

A resolver fetches typed variables, while an environment selects the variables a task receives.

Use to:

- load typed environment variables for a task
- select secrets from command context
- write values through a secret provider

### Resolver and selected environment

```ts
import { defineEnv, defineEnvResolver } from '@pokit/core';
import { z } from 'zod';

const resolver = defineEnvResolver({
  requiredContext: z.object({}),
  availableVars: ['DATABASE_URL', 'API_KEY'] as const,
  resolve: async (keys) => fetchSecrets(keys),
});

export const dbEnv = defineEnv({
  resolver,
  vars: ['DATABASE_URL'],
});
```

Attach it to a task with `env: dbEnv`; resolved values are available through `ctx.envs.DATABASE_URL`.

### Context-dependent resolver

```ts
import { defineEnv, defineEnvResolver, defineTask } from '@pokit/core';
import { z } from 'zod';

const resolver = defineEnvResolver({
  requiredContext: z.object({ env: z.enum(['staging', 'prod']) }),
  availableVars: ['DATABASE_URL'] as const,
  resolve: async (keys, { env }) => fetchSecretsFor(env, keys),
});

const dbEnv = defineEnv({ resolver, vars: ['DATABASE_URL'] });

export const migrateTask = defineTask({
  label: 'Migrate database',
  env: dbEnv,
  exec: 'prisma migrate deploy',
});
```

A command context field named `env` supplies the resolver context when it runs `migrateTask`.

**Full docs:** [Environments and resolvers](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/environments.md) · [`defineEnv` API](https://raw.githubusercontent.com/djgrant/pok/main/docs/api/define-env.md)

## Pre-flight checks

A pre-flight check validates an external prerequisite before command execution.

Use to:

- verify executables, services, or files
- verify authentication or network resources
- provide remediation before command execution

### Executable check

```ts
import { commandExists, defineCheck } from '@pokit/core';

export const dockerInstalled = defineCheck({
  label: 'Docker installed',
  check: async () => {
    if (!(await commandExists('docker'))) throw new Error('Docker is unavailable');
  },
  remediation: 'Install Docker Desktop',
  documentationUrl: 'https://docs.docker.com/get-docker/',
});
```

### Network check

```ts
import { defineCheck, defineCommand } from '@pokit/core';

export const apiAvailable = defineCheck({
  label: 'Deployment API available',
  check: async () => {
    const response = await fetch('https://deploy.example.com/health');
    if (!response.ok) throw new Error(`API returned ${response.status}`);
  },
  remediation: 'Connect to the deployment VPN and retry',
});

export const command = defineCommand({
  label: 'Deploy',
  pre: [dockerInstalled, apiAvailable],
  run: (r) => r.exec('deploy'),
});
```

**Full docs:** [Pre-flight checks](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/checks.md) · [`defineCheck` API](https://raw.githubusercontent.com/djgrant/pok/main/docs/api/define-check.md)

## Runner composition

The runner executes commands and tasks while emitting structured progress and output events.

Use to:

- present multi-step work
- compose tasks
- run long-lived processes concurrently

### Sequential group

```ts
run: async (r) => {
  await r.group('Quality', { layout: 'sequence' }, async (group) => {
    await group.activity('Types', () => r.exec('bun run typecheck'));
    await group.activity('Tests', () => r.exec('bun test'));
  });
},
```

### Parallel work

```ts
run: async (r) => {
  await r.parallel([
    r.exec('bun run dev'),
    r.exec('bun run watch:css'),
  ]);
},
```

**Full docs:** [Runner API](https://raw.githubusercontent.com/djgrant/pok/main/docs/api/runner.md) · [Tasks: composition](https://raw.githubusercontent.com/djgrant/pok/main/docs/manual/tasks.md)
