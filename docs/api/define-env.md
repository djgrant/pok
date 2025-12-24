# defineEnv & defineEnvResolver

Defines environment configurations for fetching and managing secrets/configuration.

## Overview

pok's environment system has two parts:

1. **Resolver** - The "backend" that knows how to fetch variables (e.g., from 1Password, AWS Secrets Manager)
2. **Env** - The "frontend" that selects which variables a task needs

## Import

```typescript
import { defineEnv, defineEnvResolver } from '@openpok/core';
```

## defineEnvResolver

Creates a resolver that fetches environment variables based on context.

### Signature

```typescript
function defineEnvResolver<TContext, TAvailableVars extends string>(config: {
  requiredContext: z.ZodObject<TContext>;
  availableVars: readonly TAvailableVars[];
  resolve: (keys: string[], context: TContext) => Promise<Record<string, string>>;
  write?: (values: Record<string, string>, context: TContext) => Promise<void>;
}): TypedEnvResolver<TAvailableVars>
```

### Configuration

| Property | Type | Description |
|----------|------|-------------|
| `requiredContext` | `z.ZodObject` | Zod schema for context this resolver needs |
| `availableVars` | `readonly string[]` | List of variable names this resolver can provide |
| `resolve` | `Function` | Async function to fetch requested variables |
| `write` | `Function` | Optional function to persist variables |

### Example

```typescript
import { z } from 'zod';
import { defineEnvResolver } from '@openpok/core';

const opResolver = defineEnvResolver({
  // This resolver needs an 'env' field in the command context
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
  }),
  
  // Variables this resolver can provide
  availableVars: [
    'DATABASE_URL',
    'REDIS_URL',
    'API_KEY',
    'STRIPE_SECRET_KEY',
  ] as const, // Use 'as const' for type inference
  
  // Fetch the requested keys
  resolve: async (keys, ctx) => {
    const vault = getVaultForEnv(ctx.env);
    const secrets: Record<string, string> = {};
    
    for (const key of keys) {
      secrets[key] = await vault.get(key);
    }
    
    return secrets;
  },
  
  // Optional: write secrets back
  write: async (values, ctx) => {
    const vault = getVaultForEnv(ctx.env);
    for (const [key, value] of Object.entries(values)) {
      await vault.set(key, value);
    }
  },
});
```

## defineEnv

Creates an environment that selects specific variables from a resolver.

### Signature

```typescript
function defineEnv<TResolver, TVars extends TResolver['availableVars'][number]>(config: {
  resolver: TResolver;
  vars: readonly TVars[];
}): Env<InferResolverContext<TResolver>, TVars>
```

### Example

```typescript
import { defineEnv } from '@openpok/core';

// Select only database variables
const dbEnv = defineEnv({
  resolver: opResolver,
  vars: ['DATABASE_URL', 'REDIS_URL'],
});

// Select only API keys
const apiEnv = defineEnv({
  resolver: opResolver,
  vars: ['API_KEY', 'STRIPE_SECRET_KEY'],
});
```

## Using in Tasks

```typescript
import { defineTask } from '@openpok/core';

// Task with single env
const migrateTask = defineTask({
  label: 'Run migrations',
  env: dbEnv,
  exec: (ctx) => {
    // ctx.envs.DATABASE_URL is available as string
    // ctx.envs.REDIS_URL is available as string
    return 'prisma migrate deploy';
  },
});

// Task with multiple envs
const deployTask = defineTask({
  label: 'Deploy',
  env: [dbEnv, apiEnv], // All vars merged
  run: async (r, ctx) => {
    // ctx.envs.DATABASE_URL
    // ctx.envs.REDIS_URL
    // ctx.envs.API_KEY
    // ctx.envs.STRIPE_SECRET_KEY
    await r.exec('deploy');
  },
});
```

## Type Inference

### Infer Resolver Context

```typescript
import type { InferResolverContext } from '@openpok/core';

type Ctx = InferResolverContext<typeof opResolver>;
// { env: 'dev' | 'staging' | 'prod' }
```

### Infer Env Vars

```typescript
import type { InferEnvVars } from '@openpok/core';

type Vars = InferEnvVars<typeof dbEnv>;
// { DATABASE_URL: string; REDIS_URL: string }
```

### Infer Env Context

```typescript
import type { InferEnvContext } from '@openpok/core';

type Ctx = InferEnvContext<typeof dbEnv>;
// { env: 'dev' | 'staging' | 'prod' }
```

## Composite Resolvers

Combine multiple resolvers into one:

```typescript
import { defineCompositeResolver } from '@openpok/core';

const compositeResolver = defineCompositeResolver({
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
    region: z.enum(['us', 'eu']),
  }),
  resolvers: [
    {
      resolver: opResolver,
      mapContext: (ctx) => ({ env: ctx.env }),
    },
    {
      resolver: awsResolver,
      mapContext: (ctx) => ({ region: ctx.region }),
    },
  ],
});
```

## Writing Environment Variables

Resolvers can optionally implement a `write` method for persisting values:

```typescript
// Resolver with write capability
const secretsResolver = defineEnvResolver({
  requiredContext: z.object({ env: z.enum(['dev', 'prod']) }),
  availableVars: ['NEW_API_KEY'] as const,
  resolve: async (keys, ctx) => { /* ... */ },
  write: async (values, ctx) => {
    // Persist values to secret store
    await secretStore.write(ctx.env, values);
  },
});

// Env for writing
const writableEnv = defineEnv({
  resolver: secretsResolver,
  vars: ['NEW_API_KEY'],
});

// Task that writes
const bootstrapTask = defineTask({
  label: 'Bootstrap',
  envWriter: writableEnv, // Enables ctx.writeEnvs
  run: async (r, ctx) => {
    const key = generateApiKey();
    await ctx.writeEnvs({ NEW_API_KEY: key });
  },
});
```

## Context Requirements

Tasks inherit context from their parent command. The type system ensures commands provide the context that tasks require:

```typescript
// Task requires { env: 'dev' | 'prod' }
const task = defineTask({
  env: dbEnv, // dbEnv's resolver requires { env }
  exec: 'migrate',
});

// Command must provide matching context
const command = defineCommand({
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'prod']), // Satisfies requirement
    },
  },
  run: async (r) => {
    await r.run(task); // OK
  },
});
```

## Helper Functions

### getEnvKeys

Get the list of variable keys from an env:

```typescript
import { getEnvKeys } from '@openpok/core';

const keys = getEnvKeys(dbEnv);
// ['DATABASE_URL', 'REDIS_URL']
```

## Related

- [defineTask](./define-task.md) - Using envs in tasks
- [defineCommand](./define-command.md) - Providing context
