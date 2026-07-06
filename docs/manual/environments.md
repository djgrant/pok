# Environments

pok resolves environment variables through typed resolvers. Commands provide context such as `env` or `region`, tasks declare which variables they need, and resolvers fetch only those keys.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Command                               │
│  context: { env: 'staging' }                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         Task                                 │
│  env: dbEnv                                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                          Env                                 │
│  resolver: secretsResolver                                  │
│  vars: ['DATABASE_URL']                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Resolver                               │
│  requiredContext: { env: z.enum(['dev', 'staging', 'prod']) }│
│  resolve(keys, { env: 'staging' }) → { DATABASE_URL: '...' }│
└─────────────────────────────────────────────────────────────┘
```

## Creating Resolvers

### Basic Resolver

```typescript
import { z } from 'zod';
import { defineEnvResolver } from '@pokit/core';

const envResolver = defineEnvResolver({
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
  }),

  availableVars: ['DATABASE_URL', 'REDIS_URL', 'API_KEY'] as const,

  resolve: async (keys, ctx) => {
    // Fetch only requested keys
    const result: Record<string, string> = {};

    for (const key of keys) {
      result[key] = await fetchSecret(ctx.env, key);
    }

    return result;
  },
});
```

### 1Password Resolver

```typescript
const opResolver = defineEnvResolver({
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
  }),

  availableVars: ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'SENDGRID_API_KEY'] as const,

  resolve: async (keys, ctx) => {
    const vaultId = getVaultForEnv(ctx.env);
    const result: Record<string, string> = {};

    for (const key of keys) {
      const ref = `op://${vaultId}/${key}`;
      result[key] = await $`op read ${ref}`.text();
    }

    return result;
  },
});
```

### AWS Secrets Manager Resolver

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const awsResolver = defineEnvResolver({
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
    region: z.enum(['us-east-1', 'eu-west-1']),
  }),

  availableVars: ['AWS_SECRET_1', 'AWS_SECRET_2'] as const,

  resolve: async (keys, ctx) => {
    const client = new SecretsManager({ region: ctx.region });
    const secretName = `${ctx.env}/app-secrets`;

    const response = await client.getSecretValue({ SecretId: secretName });
    const secrets = JSON.parse(response.SecretString!);

    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = secrets[key];
    }
    return result;
  },
});
```

### Writable Resolver

```typescript
const secretsResolver = defineEnvResolver({
  requiredContext: z.object({ env: z.enum(['dev', 'prod']) }),
  availableVars: ['API_KEY', 'WEBHOOK_SECRET'] as const,

  resolve: async (keys, ctx) => {
    // Read from storage
    return await readSecrets(ctx.env, keys);
  },

  write: async (values, ctx) => {
    // Persist to storage
    await writeSecrets(ctx.env, values);
  },
});
```

## Creating Envs

### Basic Env

```typescript
const dbEnv = defineEnv({
  resolver: secretsResolver,
  vars: ['DATABASE_URL'],
});
```

### Multiple Vars

```typescript
const fullEnv = defineEnv({
  resolver: secretsResolver,
  vars: ['DATABASE_URL', 'REDIS_URL', 'API_KEY'],
});
```

### Subset for Different Use Cases

```typescript
// Full resolver with many vars
const resolver = defineEnvResolver({
  availableVars: ['DATABASE_URL', 'REDIS_URL', 'API_KEY', 'STRIPE_KEY', 'SENDGRID_KEY'] as const,
  // ...
});

// Different envs for different tasks
const dbEnv = defineEnv({ resolver, vars: ['DATABASE_URL'] });
const cacheEnv = defineEnv({ resolver, vars: ['REDIS_URL'] });
const paymentEnv = defineEnv({ resolver, vars: ['STRIPE_KEY'] });
const emailEnv = defineEnv({ resolver, vars: ['SENDGRID_KEY'] });
```

## Using in Tasks

### Single Env

```typescript
const migrateTask = defineTask({
  label: 'Migrate',
  env: dbEnv,
  exec: (ctx) => {
    // ctx.envs.DATABASE_URL is string
    return 'prisma migrate deploy';
  },
});
```

### Multiple Envs

```typescript
const deployTask = defineTask({
  label: 'Deploy',
  env: [dbEnv, cacheEnv, paymentEnv],
  run: async (r, ctx) => {
    // All vars available
    ctx.envs.DATABASE_URL;
    ctx.envs.REDIS_URL;
    ctx.envs.STRIPE_KEY;
  },
});
```

### Writing Envs

```typescript
const bootstrapTask = defineTask({
  label: 'Bootstrap',
  envWriter: secretsEnv,
  run: async (r, ctx) => {
    const key = await generateKey();
    await ctx.writeEnvs({ API_KEY: key });
  },
});
```

## Composite Resolvers

Combine multiple resolvers:

```typescript
import { defineCompositeResolver } from '@pokit/core';

const compositeResolver = defineCompositeResolver({
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
    region: z.enum(['us', 'eu']),
  }),

  resolvers: [
    {
      resolver: opResolver, // Has DATABASE_URL, STRIPE_KEY
      mapContext: (ctx) => ({ env: ctx.env }),
    },
    {
      resolver: awsResolver, // Has AWS secrets
      mapContext: (ctx) => ({ region: ctx.region }),
    },
  ],
});
```

## Context Flow

Context flows from command → task → env → resolver:

```typescript
// 1. Command defines context
defineCommand({
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']),
    },
  },
  run: async (r) => {
    // 2. Task uses env
    await r.run(migrateTask);
  },
});

// 3. Task declares env
const migrateTask = defineTask({
  env: dbEnv, // 4. Env uses resolver
  exec: 'prisma migrate',
});

// 5. Resolver receives context
resolve: async (keys, ctx) => {
  // ctx.env is 'dev' | 'staging' | 'prod'
  return fetchSecrets(ctx.env, keys);
},
```

### Static Context Pattern

Sometimes you want to create specialized commands that "fix" a context value (like `env`) so users don't have to provide it as a flag. You can do this by providing a literal value in the `context` object:

```typescript
// commands/deploy.prod.ts
export const command = defineCommand({
  label: 'Deploy to Production',
  context: {
    env: 'prod', // Satisfies { env: string } requirement statically
  },
  run: async (r) => {
    // No flag required, but task receives env: 'prod'
    await r.run(deployTask);
  },
});
```

This ensures the command remains type-safe and tasks get the context they need, without cluttering the CLI interface with unnecessary flags for that specific command.

## Caching

Resolved values are cached per runner session:

```typescript
run: async (r) => {
  await r.run(task1); // Resolves DATABASE_URL
  await r.run(task2); // Uses cached value
  await r.run(task3); // Uses cached value

  // Also available in exec
  await r.exec('psql $DATABASE_URL');
},
```

## Loading Indicator

While secrets resolve, the reporter shows a loading indicator:

```
◆  Loading Secrets
│  ◇  DATABASE_URL, REDIS_URL
│  ◇  STRIPE_KEY
```

## Type Safety

The type system ensures:

1. **Vars are valid** - Only declared vars can be used

```typescript
const dbEnv = defineEnv({
  resolver,
  vars: ['DATABASE_URL', 'TYPO_VAR'], // Error: TYPO_VAR not in resolver
});
```

2. **Context requirements are met**

```typescript
// Task requires { env: string } context
const task = defineTask({
  env: dbEnv,
  exec: 'migrate',
});

// Command missing env - TypeScript error
defineCommand({
  run: async (r) => {
    await r.run(task); // Error
  },
});
```

3. **Envs are typed correctly**

```typescript
const task = defineTask({
  env: dbEnv,
  exec: (ctx) => {
    ctx.envs.DATABASE_URL; // string
    ctx.envs.UNKNOWN; // Error
  },
});
```

## Best Practices

### 1. Minimize Var Selection

Only select vars you need:

```typescript
// Good - minimal
const migrateEnv = defineEnv({ resolver, vars: ['DATABASE_URL'] });

// Avoid - unnecessary exposure
const allEnv = defineEnv({ resolver, vars: allAvailableVars });
```

### 2. Group Related Vars

```typescript
const dbEnv = defineEnv({ resolver, vars: ['DATABASE_URL', 'DATABASE_POOL_SIZE'] });
const emailEnv = defineEnv({ resolver, vars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER'] });
```

### 3. Use Descriptive Names

```typescript
// Good
const productionDbEnv = defineEnv({ ... });
const developmentDbEnv = defineEnv({ ... });

// Avoid
const env1 = defineEnv({ ... });
const env2 = defineEnv({ ... });
```

### 4. Handle Resolution Errors

```typescript
resolve: async (keys, ctx) => {
  try {
    return await fetchSecrets(keys);
  } catch (error) {
    throw new Error(`Failed to fetch secrets for ${ctx.env}: ${error.message}`);
  }
},
```
