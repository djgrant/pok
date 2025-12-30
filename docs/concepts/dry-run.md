# Dry Run Pattern

Many CLI commands benefit from a "dry run" mode that shows what would happen without making actual changes. This is especially useful for destructive operations like deployments, migrations, or file deletions.

## Overview

The dry run pattern provides:

1. **`dryRunContext`** - Standard context field definition for `--dry-run` flag
2. **`WithDryRun<C>`** - Type helper for context types with dry-run
3. **`createDryRunReporter`** - Reporter wrapper for dry-run output

## Basic Usage

### Adding Dry Run to a Command

```typescript
import { z } from 'zod';
import { defineCommand, dryRunContext, createDryRunReporter } from '@pokjs/core';

export const command = defineCommand({
  label: 'Deploy to environment',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['staging', 'prod']),
    },
    ...dryRunContext, // Adds --dry-run flag
  },
  run: async (r, ctx) => {
    const dry = createDryRunReporter(r.reporter);

    if (ctx.context.dryRun) {
      dry.summary([
        'Build application',
        'Push to registry',
        'Update load balancer',
        'Run health checks',
      ]);
      return;
    }

    // Actual deployment logic...
    await r.exec('npm run build');
    await r.exec('docker push myapp:latest');
  },
});
```

### Running in Dry Run Mode

```bash
$ mycli deploy --env staging --dry-run
[DRY RUN] Would execute:
  - Build application
  - Push to registry
  - Update load balancer
  - Run health checks

No changes were made.
```

## Dry Run Reporter API

The `createDryRunReporter` function wraps your command reporter with specialized methods for dry-run output:

### wouldExecute

Report a single action that would be executed:

```typescript
dry.wouldExecute('Build application');
// Output: [DRY RUN] Would: Build application
```

### wouldRun

Report a shell command that would be executed:

```typescript
dry.wouldRun('docker push myapp:latest');
// Output: [DRY RUN] Would run: docker push myapp:latest
```

### summary

Report a summary of all planned actions:

```typescript
dry.summary(['Build application', 'Push to registry', 'Update load balancer']);
// Output:
// [DRY RUN] Would execute:
//   - Build application
//   - Push to registry
//   - Update load balancer
//
// No changes were made.
```

## Patterns

### Step-by-Step Dry Run

For commands with complex logic, report each step as you go:

```typescript
run: async (r, ctx) => {
  const dry = createDryRunReporter(r.reporter);
  const { dryRun } = ctx.context;

  // Database migrations
  if (dryRun) {
    dry.wouldExecute('Run database migrations');
  } else {
    await r.exec('prisma migrate deploy');
  }

  // Build
  if (dryRun) {
    dry.wouldRun('npm run build');
  } else {
    await r.exec('npm run build');
  }

  // Deploy
  if (dryRun) {
    dry.wouldRun('kubectl apply -f deployment.yaml');
  } else {
    await r.exec('kubectl apply -f deployment.yaml');
  }

  if (dryRun) {
    r.reporter.info('');
    r.reporter.info('No changes were made.');
  }
},
```

### Early Return Pattern

For simpler commands, collect all actions and return early:

```typescript
run: async (r, ctx) => {
  const dry = createDryRunReporter(r.reporter);

  if (ctx.context.dryRun) {
    dry.summary([
      'Delete temporary files',
      'Clear build cache',
      'Remove node_modules',
    ]);
    return;
  }

  await r.exec('rm -rf temp');
  await r.exec('rm -rf .cache');
  await r.exec('rm -rf node_modules');
},
```

### Conditional Actions

Show conditional actions based on context:

```typescript
run: async (r, ctx) => {
  const dry = createDryRunReporter(r.reporter);
  const actions: string[] = [];

  actions.push('Build application');
  actions.push('Push to registry');

  if (ctx.context.env === 'prod') {
    actions.push('Create production backup');
    actions.push('Notify on-call team');
  }

  actions.push('Deploy to ' + ctx.context.env);
  actions.push('Run health checks');

  if (ctx.context.dryRun) {
    dry.summary(actions);
    return;
  }

  // Actual implementation...
},
```

### Helper Function Pattern

For repeated operations, create a helper:

```typescript
async function runOrReport(
  runner: Runner,
  action: string,
  command: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    runner.reporter.step(`[DRY RUN] Would run: ${command}`);
    return;
  }
  await runner.exec(command);
}

run: async (r, ctx) => {
  const { dryRun } = ctx.context;

  await runOrReport(r, 'Build', 'npm run build', dryRun);
  await runOrReport(r, 'Test', 'npm test', dryRun);
  await runOrReport(r, 'Deploy', 'npm run deploy', dryRun);

  if (dryRun) {
    r.reporter.info('');
    r.reporter.info('No changes were made.');
  }
},
```

## Type Safety

### Using WithDryRun Type

For type-safe context handling:

```typescript
import { type WithDryRun } from '@pokjs/core';

type MyContext = {
  env: 'dev' | 'staging' | 'prod';
  force: boolean;
};

type MyContextWithDryRun = WithDryRun<MyContext>;
// Result: { env: 'dev' | 'staging' | 'prod'; force: boolean; dryRun: boolean }
```

### Inferring Context Type

The context is automatically typed when using `dryRunContext`:

```typescript
context: {
  env: { from: 'flag', schema: z.enum(['dev', 'prod']) },
  ...dryRunContext,
},
run: async (r, ctx) => {
  // ctx.context.dryRun is typed as boolean
  // ctx.context.env is typed as 'dev' | 'prod'
},
```

## Visual Output

### Summary Mode

```
$ mycli deploy --env prod --dry-run
[DRY RUN] Would execute:
  - Create database backup
  - Build application
  - Push to production registry
  - Update load balancer
  - Run health checks
  - Notify team on Slack

No changes were made.
```

### Step-by-Step Mode

```
$ mycli migrate --dry-run
[DRY RUN] Would: Check database connection
[DRY RUN] Would run: prisma migrate status
[DRY RUN] Would: Apply pending migrations
[DRY RUN] Would run: prisma migrate deploy
[DRY RUN] Would: Verify schema

No changes were made.
```

## Best Practices

### 1. Always Show What Would Happen

```typescript
// Good - shows specific actions
dry.summary([
  `Deploy version ${version} to ${env}`,
  `Update ${replicas} replicas`,
  'Run database migrations',
]);

// Bad - too vague
dry.summary(['Deploy application']);
```

### 2. Include Commands When Helpful

```typescript
// For debugging, show actual commands
dry.wouldRun(`docker push ${registry}/${image}:${tag}`);
dry.wouldRun(`kubectl set image deployment/${name} app=${image}:${tag}`);
```

### 3. Group Related Actions

```typescript
r.reporter.info('[DRY RUN] Database operations:');
dry.wouldExecute('Create backup');
dry.wouldExecute('Apply migrations');

r.reporter.info('');
r.reporter.info('[DRY RUN] Deployment:');
dry.wouldExecute('Build container');
dry.wouldExecute('Push to registry');
```

### 4. Show Environment-Specific Actions

```typescript
if (ctx.context.dryRun) {
  const actions = ['Build application', 'Run tests'];

  if (ctx.context.env === 'prod') {
    actions.push('Create backup (production only)');
    actions.push('Send deployment notification');
  }

  dry.summary(actions);
  return;
}
```

### 5. Test Dry Run Mode

```typescript
import { captureEvents } from '../utils';

describe('Deploy command', () => {
  it('does not execute commands in dry-run mode', async () => {
    const { events, error } = await captureEvents(['deploy', '--env', 'staging', '--dry-run']);

    expect(error).toBeUndefined();

    // Verify dry-run output was logged
    const logs = events.filter((e) => e.type === 'log');
    const messages = logs.map((e) => (e.type === 'log' ? e.message : ''));

    expect(messages.some((m) => m.includes('[DRY RUN]'))).toBe(true);
    expect(messages.some((m) => m.includes('No changes were made'))).toBe(true);
  });
});
```

## Related

- [API Reference: defineCommand](../api/define-command.md)
- [Commands](./commands.md)
- [Tasks](./tasks.md)
