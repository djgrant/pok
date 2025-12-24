# Tasks Deep Dive

Tasks are reusable units of work with environment requirements and parameters. This guide covers advanced patterns.

## When to Use Tasks

Use tasks when you need:

1. **Reusability** - Same logic in multiple commands
2. **Environment variables** - Secrets that need resolution
3. **Parameters** - Validated input for the operation
4. **Type safety** - Ensure context requirements are met

## Exec vs Run Tasks

### Exec Tasks

For simple shell commands:

```typescript
const buildTask = defineTask({
  label: 'Build',
  exec: 'npm run build',
});

// With dynamic command
const migrateTask = defineTask({
  label: 'Migrate',
  params: z.object({ dryRun: z.boolean().default(false) }),
  exec: (ctx) => `prisma migrate ${ctx.params.dryRun ? '--dry-run' : ''}`,
});
```

### Run Tasks

For complex logic:

```typescript
const setupTask = defineTask({
  label: 'Setup',
  run: async (r, ctx) => {
    ctx.reporter.info('Setting up...');

    await r.exec('npm install');
    await r.exec('npm run db:setup');

    ctx.reporter.success('Ready!');
  },
});
```

## Environment Patterns

### Single Environment

```typescript
const dbEnv = defineEnv({
  resolver: secretsResolver,
  vars: ['DATABASE_URL'],
});

const migrateTask = defineTask({
  label: 'Migrate',
  env: dbEnv,
  exec: 'prisma migrate deploy', // DATABASE_URL available
});
```

### Multiple Environments

```typescript
const deployTask = defineTask({
  label: 'Deploy',
  env: [dbEnv, apiEnv, awsEnv], // All merged
  exec: (ctx) => {
    // ctx.envs.DATABASE_URL
    // ctx.envs.API_KEY
    // ctx.envs.AWS_ACCESS_KEY
    return 'deploy';
  },
});
```

### Environment Caching

Resolved environments are cached for the runner session:

```typescript
run: async (r) => {
  await r.run(task1); // Resolves DATABASE_URL
  await r.run(task2); // Uses cached DATABASE_URL
  await r.exec('psql $DATABASE_URL'); // Also available
},
```

## Parameter Patterns

### Basic Parameters

```typescript
const deployTask = defineTask({
  label: 'Deploy',
  params: z.object({
    env: z.enum(['staging', 'prod']),
    version: z.string(),
  }),
  exec: (ctx) => `deploy --env ${ctx.params.env} --version ${ctx.params.version}`,
});

// Usage
await r.run(deployTask, { env: 'staging', version: '1.2.3' });
```

### Optional Parameters

```typescript
const buildTask = defineTask({
  label: 'Build',
  params: z.object({
    mode: z.enum(['dev', 'prod']).default('prod'),
    sourcemaps: z.boolean().optional(),
  }),
  exec: (ctx) => {
    let cmd = `build --mode ${ctx.params.mode}`;
    if (ctx.params.sourcemaps) {
      cmd += ' --sourcemaps';
    }
    return cmd;
  },
});

// All valid
await r.run(buildTask);
await r.run(buildTask, { mode: 'dev' });
await r.run(buildTask, { mode: 'prod', sourcemaps: true });
```

### Complex Parameters

```typescript
const deployTask = defineTask({
  label: 'Deploy',
  params: z.object({
    services: z.array(z.string()),
    config: z.object({
      replicas: z.number(),
      memory: z.string(),
    }),
  }),
  run: async (r, ctx) => {
    for (const service of ctx.params.services) {
      await r.exec(`deploy ${service} --replicas ${ctx.params.config.replicas}`);
    }
  },
});
```

## Return Values

Tasks can return typed values:

```typescript
const getVersionTask = defineTask({
  label: 'Get version',
  run: async (r, ctx) => {
    const pkg = await Bun.file('package.json').json();
    return pkg.version as string;
  },
});

// Usage
const version = await r.run(getVersionTask);
// version is typed as string
```

## Writing Environment Variables

For tasks that need to persist secrets:

```typescript
const secretsEnv = defineEnv({
  resolver: secretsResolver, // Must implement write()
  vars: ['API_KEY'],
});

const rotateKeyTask = defineTask({
  label: 'Rotate API key',
  envWriter: secretsEnv,
  run: async (r, ctx) => {
    const newKey = await generateApiKey();
    await ctx.writeEnvs({ API_KEY: newKey });
    ctx.reporter.success('API key rotated');
  },
});
```

## Task Context

The full TaskContext:

```typescript
type TaskContext = {
  context: TContext; // From parent command
  cwd: string; // Project root
  envs: TEnvs; // Resolved env vars
  params: TParams; // Validated parameters
  extraArgs: string[]; // Remaining CLI args
  reporter: TaskReporter; // Event emission
  writeEnvs: TWriteEnvs; // Write function (if envWriter)
};
```

### Accessing Command Context

```typescript
const deployTask = defineTask({
  label: 'Deploy',
  env: envWithEnvContext, // Requires { env: string }
  run: async (r, ctx) => {
    // ctx.context.env comes from the parent command
    ctx.reporter.info(`Deploying to ${ctx.context.env}`);
  },
});
```

## Tabs with Tasks

Tasks work seamlessly with `r.tabs()`:

```typescript
run: async (r) => {
  await r.tabs([
    r.run(devServerTask),
    r.run(watcherTask),
    r.exec('stripe listen'),
  ]);
},
```

The `shortLabel` property controls tab names:

```typescript
const devServerTask = defineTask({
  label: 'Development Server',
  shortLabel: 'dev', // Tab shows "dev"
  exec: 'npm run dev',
});
```

## Composition Patterns

### Task Sequences

```typescript
const deployTask = defineTask({
  label: 'Deploy',
  run: async (r, ctx) => {
    await r.run(buildTask);
    await r.run(testTask);
    await r.run(pushTask, { env: ctx.params.env });
  },
});
```

### Conditional Tasks

```typescript
const releaseTask = defineTask({
  label: 'Release',
  params: z.object({
    skipTests: z.boolean().default(false),
  }),
  run: async (r, ctx) => {
    await r.run(buildTask);

    if (!ctx.params.skipTests) {
      await r.run(testTask);
    }

    await r.run(publishTask);
  },
});
```

### Parallel Tasks

```typescript
const setupTask = defineTask({
  label: 'Setup',
  run: async (r, ctx) => {
    await r.parallel([r.run(installDepsTask), r.run(setupDbTask), r.run(generateTypesTask)]);
  },
});
```

## Best Practices

### 1. Single Responsibility

Each task should do one thing:

```typescript
// Good
const buildTask = defineTask({ exec: 'npm run build' });
const testTask = defineTask({ exec: 'npm run test' });

// Bad - too many concerns
const everythingTask = defineTask({
  run: async (r) => {
    await r.exec('npm install');
    await r.exec('npm run build');
    await r.exec('npm run test');
    await r.exec('npm run deploy');
  },
});
```

### 2. Descriptive Labels

```typescript
// Good
const migrateTask = defineTask({
  label: 'Run database migrations',
  shortLabel: 'migrate',
});

// Bad
const task1 = defineTask({
  label: 'Do stuff',
});
```

### 3. Type Your Parameters

```typescript
// Good - explicit schema
params: z.object({
  env: z.enum(['dev', 'staging', 'prod']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
}),

// Avoid - loose types
params: z.record(z.unknown()),
```

### 4. Handle Errors Gracefully

```typescript
run: async (r, ctx) => {
  try {
    await r.exec('risky-operation');
  } catch (error) {
    ctx.reporter.error('Operation failed');
    ctx.reporter.info('Attempting recovery...');
    await r.exec('recovery-operation');
  }
},
```

## Related

- [API Reference: defineTask](../api/define-task.md)
- [Environments](./environments.md)
- [Commands](./commands.md)
