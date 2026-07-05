# defineTask

Defines a reusable unit of work with environment requirements and parameters.

## Import

```typescript
import { defineTask } from '@pokit/core';
```

## Signature

```typescript
// Exec task - runs a shell command
function defineTask<TEnv, TParams, TEnvWriter>(config: {
  label: string;
  shortLabel?: string;
  env?: TEnv;
  params?: TParams;
  envWriter?: TEnvWriter;
  retry?: RetryConfig;
  exec: ExecInput | ((ctx: TaskContext) => ExecInput);
}): ExecTaskConfig;

// Run task - custom logic
function defineTask<TEnv, TParams, TEnvWriter, TReturn>(config: {
  label: string;
  shortLabel?: string;
  env?: TEnv;
  params?: TParams;
  envWriter?: TEnvWriter;
  retry?: RetryConfig;
  run: (runner: Runner, ctx: TaskContext) => Promise<TReturn> | TReturn;
}): RunTaskConfig;
```

## Configuration

| Property     | Type                 | Description                                           |
| ------------ | -------------------- | ----------------------------------------------------- |
| `label`      | `string`             | Human-readable label                                  |
| `shortLabel` | `string`             | Short label for tabs (defaults to first word of exec) |
| `env`        | `Env \| Env[]`       | Environment(s) to resolve before execution            |
| `params`     | `z.ZodType`          | Zod schema for task parameters                        |
| `envWriter`  | `Env`                | Environment for writing (enables `ctx.writeEnvs`)     |
| `retry`      | `RetryConfig`        | Retry configuration for failed executions             |
| `exec`       | `string \| Function` | Shell command to execute                              |
| `run`        | `Function`           | Custom execution logic                                |

### RetryConfig

```typescript
type RetryConfig = {
  maxAttempts: number; // Retry attempts (not including initial)
  delay?: number; // Base delay in ms (default: 1000)
  backoff?: BackoffStrategy; // Default: 'fixed'
  maxDelay?: number; // Cap for backoff growth
};

type BackoffStrategy = 'fixed' | 'linear' | 'exponential';
```

Backoff strategies:

- `fixed`: Same delay between each retry
- `linear`: Delay increases linearly (`delay * attempt`)
- `exponential`: Delay doubles each attempt (`delay * 2^attempt`)

## TaskContext

```typescript
type TaskContext<TEnvs, TParams, TWriteEnvs, TContext> = {
  context: TContext; // Inherited from parent command
  cwd: string; // Project root
  envs: TEnvs; // Resolved environment variables
  params: TParams; // Validated parameters
  extraArgs: string[]; // Remaining CLI args
  reporter: TaskReporter; // Event emission
  writeEnvs: TWriteEnvs; // Write function (if envWriter defined)
};
```

## Examples

### Simple Exec Task

```typescript
import { defineTask } from '@pokit/core';

export const build = defineTask({
  label: 'Build project',
  exec: 'npm run build',
});
```

### Exec Task with Parameters

```typescript
import { z } from 'zod';
import { defineTask } from '@pokit/core';

export const migrate = defineTask({
  label: 'Run migrations',
  params: z.object({
    dryRun: z.boolean().default(false),
  }),
  exec: (ctx) => `prisma migrate deploy ${ctx.params.dryRun ? '--dry-run' : ''}`,
});

// Usage in command
await r.run(migrate, { dryRun: true });
```

### Task with Environment

```typescript
import { defineTask, defineEnv, defineEnvResolver } from '@pokit/core';
import { z } from 'zod';

// Define resolver
const secretsResolver = defineEnvResolver({
  requiredContext: z.object({ env: z.enum(['dev', 'staging', 'prod']) }),
  availableVars: ['DATABASE_URL', 'API_KEY'] as const,
  resolve: async (keys, ctx) => {
    // Fetch secrets based on environment
    return { DATABASE_URL: '...', API_KEY: '...' };
  },
});

// Define env selecting specific vars
const dbEnv = defineEnv({
  resolver: secretsResolver,
  vars: ['DATABASE_URL'],
});

// Task using the env
export const migrate = defineTask({
  label: 'Run migrations',
  env: dbEnv,
  exec: (ctx) => {
    // ctx.envs.DATABASE_URL is available
    return 'prisma migrate deploy';
  },
});
```

### Run Task with Custom Logic

```typescript
import { defineTask } from '@pokit/core';

export const setup = defineTask({
  label: 'Setup development',
  run: async (r, ctx) => {
    ctx.reporter.info('Setting up...');

    await r.exec('npm install');
    await r.exec('npm run db:setup');

    ctx.reporter.success('Ready!');
  },
});
```

### Task with Retry

```typescript
import { defineTask } from '@pokit/core';

// Retry with exponential backoff
export const flakyApiCall = defineTask({
  label: 'Call flaky API',
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoff: 'exponential',
    maxDelay: 10000,
  },
  exec: 'curl https://flaky-api.example.com/endpoint',
});

// Run task with retry
export const deployWithRetry = defineTask({
  label: 'Deploy to CDN',
  retry: { maxAttempts: 2, delay: 5000 },
  run: async (r, ctx) => {
    ctx.reporter.info('Deploying...');
    await r.exec('aws s3 sync ./dist s3://my-bucket');
    ctx.reporter.success('Deployed!');
  },
});
```

When used in parallel, retries exhaust before parallel mode rules apply:

```typescript
// In fail-fast mode, flakyApiCall will retry up to 3 times
// before being considered a failure
await r.parallel([r.run(flakyApiCall), r.run(stableTask)], { mode: 'fail-fast' });
```

### Task with Return Value

```typescript
import { defineTask } from '@pokit/core';
import { z } from 'zod';

export const getVersion = defineTask({
  label: 'Get version',
  run: async (r, ctx) => {
    // Return value is typed
    return '1.0.0';
  },
});

// Usage
const version = await r.run(getVersion); // string
```

### Multiple Environments

```typescript
const dbEnv = defineEnv({ resolver, vars: ['DATABASE_URL'] });
const apiEnv = defineEnv({ resolver, vars: ['API_KEY'] });

export const deploy = defineTask({
  label: 'Deploy',
  env: [dbEnv, apiEnv], // Both resolved
  exec: (ctx) => {
    // ctx.envs.DATABASE_URL
    // ctx.envs.API_KEY
    return 'deploy';
  },
});
```

### Writing Environment Variables

```typescript
const secretsEnv = defineEnv({
  resolver: secretsResolver, // Resolver must implement write()
  vars: ['NEW_SECRET'],
});

export const bootstrap = defineTask({
  label: 'Bootstrap secrets',
  envWriter: secretsEnv,
  run: async (r, ctx) => {
    const secret = generateSecret();
    await ctx.writeEnvs({ NEW_SECRET: secret });
  },
});
```

## Using Tasks

Tasks are executed via `r.run()`:

```typescript
// In a command
run: async (r) => {
  // Execute directly
  await r.run(buildTask);

  // With parameters
  await r.run(migrateTask, { dryRun: true });

  // In tabs
  await r.tabs([r.run(devServerTask), r.run(watcherTask)]);
};
```

## Type Safety

The type system enforces context requirements:

```typescript
// Task requires { env: string } context
const deployTask = defineTask({
  env: envThatRequires({ env: z.enum(['dev', 'prod']) }),
  exec: 'deploy',
});

// Command provides matching context - OK
defineCommand({
  context: {
    env: { from: 'flag', schema: z.enum(['dev', 'prod']) },
  },
  run: async (r) => {
    await r.run(deployTask); // TypeScript OK
  },
});

// Command missing context - TypeScript error
defineCommand({
  run: async (r) => {
    await r.run(deployTask); // Error: context doesn't satisfy requirements
  },
});
```
