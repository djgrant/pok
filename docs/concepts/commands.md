# Commands Deep Dive

Commands are the core building block of a pok CLI. This guide covers advanced patterns and best practices.

## File-Based Discovery

Commands are discovered from `.ts` files in your commands directory:

```
commands/
├── build.ts              → mycli build
├── deploy.ts             → mycli deploy
├── db.ts                 → mycli db (parent)
├── db.migrate.ts         → mycli db migrate
└── db.migrate.up.ts      → mycli db migrate up
```

### Naming Rules

- Use lowercase with dots for hierarchy
- First segment is the top-level command
- Each dot creates a nesting level
- Files starting with `_` are ignored

### Implicit Parents

You don't need to create parent files. If you have:

```
commands/
└── db.migrate.ts
```

Then `mycli db` will show a submenu with just "migrate".

## Context Patterns

### Required vs Optional

```typescript
context: {
  // Required - prompts if missing
  env: {
    from: 'flag',
    schema: z.enum(['dev', 'prod']),
  },

  // Optional - never prompts
  verbose: {
    from: 'flag',
    schema: z.boolean().optional(),
  },

  // Default - uses default if missing
  timeout: {
    from: 'flag',
    schema: z.number().default(30000),
  },
}
```

### Complex Types

```typescript
context: {
  // Array of strings
  tags: {
    from: 'flag',
    schema: z.array(z.string()).default([]),
  },

  // Union types
  format: {
    from: 'flag',
    schema: z.enum(['json', 'yaml', 'toml']),
  },

  // Transformed values
  port: {
    from: 'flag',
    schema: z.string().transform(Number),
  },
}
```

### Dependent Context

Use hooks for context that depends on other values:

```typescript
context: {
  env: {
    from: 'flag',
    schema: z.enum(['dev', 'prod']),
  },
},
pre: (ctx) => {
  // Only require confirmation for prod
  if (ctx.env === 'prod') {
    return [prodConfirmation];
  }
  return [];
},
```

## Pre-flight Check Patterns

### Static Checks

```typescript
pre: [dockerRunning, nodeVersion, envFileExists],
```

### Dynamic Checks

```typescript
pre: (ctx) => {
  const checks = [nodeVersion];

  if (ctx.useDocker) {
    checks.push(dockerRunning);
  }

  if (ctx.env === 'prod') {
    checks.push(prodConfirmation);
  }

  return checks;
},
```

### Async Checks

```typescript
pre: async (ctx) => {
  const isCI = await checkIsCI();
  if (isCI) {
    return []; // Skip interactive checks in CI
  }
  return [confirmDeployment];
},
```

## Runner Patterns

### Sequential Execution

```typescript
run: async (r) => {
  await r.exec('npm run lint');
  await r.exec('npm run test');
  await r.exec('npm run build');
},
```

### Grouped Activities

```typescript
run: async (r) => {
  await r.group('Quality Checks', { layout: 'sequence' }, async (g) => {
    await g.activity('Lint', () => r.exec('npm run lint'));
    await g.activity('Types', () => r.exec('npm run typecheck'));
    await g.activity('Tests', () => r.exec('npm run test'));
  });
},
```

### Parallel Execution

```typescript
run: async (r) => {
  // Race semantics - first exit kills others
  await r.parallel([
    r.exec('npm run dev'),
    r.exec('npm run watch:css'),
  ]);
},
```

### Tabbed Console

```typescript
run: async (r) => {
  await r.tabs([
    r.exec('npm run dev'),
    r.exec('stripe listen'),
    r.run(watchTask),
  ], { name: 'Development' });
},
```

## Parent Command Patterns

### Simple Menu

```typescript
// commands/db.ts
export const command = defineCommand({
  label: 'Database operations',
  // No run function - shows submenu
});
```

### Run All Children

```typescript
// commands/check.ts
export const command = defineCommand({
  label: 'Run all checks',
  enableRunAllChildren: 'sequential',
});
```

Users can run:

- `mycli check` → Interactive menu
- `mycli check all` → Run all sequentially
- `mycli check lint` → Run specific check

### Parallel All Children

```typescript
export const command = defineCommand({
  label: 'Run all checks',
  enableRunAllChildren: 'parallel',
  quietRunAll: true, // Capture output, show on failure
});
```

## Error Handling

### In Run Function

```typescript
run: async (r) => {
  try {
    await r.exec('npm test');
  } catch (error) {
    if (error instanceof CommandError) {
      r.reporter.error('Tests failed');
      r.reporter.info(error.output);
    }
    throw error; // Re-throw to fail the command
  }
},
```

### Graceful Degradation

```typescript
run: async (r) => {
  try {
    await r.exec('optional-tool');
  } catch {
    r.reporter.warn('optional-tool not found, skipping');
  }

  await r.exec('npm run build'); // Always run
},
```

## Context Flow to Tasks

Context flows from commands to tasks:

```typescript
// Command provides context
defineCommand({
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'prod']),
    },
  },
  run: async (r) => {
    // Task receives context for env resolution
    await r.run(deployTask);
  },
});

// Task uses context via env resolver
const deployTask = defineTask({
  env: envThatNeedsEnvContext,
  exec: 'deploy',
});
```

## Best Practices

### 1. Keep Commands Focused

Each command should do one thing well:

```typescript
// Good - focused
export const command = defineCommand({
  label: 'Run database migrations',
  run: async (r) => {
    await r.exec('prisma migrate deploy');
  },
});

// Bad - doing too much
export const command = defineCommand({
  label: 'Setup everything',
  run: async (r) => {
    await r.exec('npm install');
    await r.exec('prisma migrate');
    await r.exec('npm run seed');
    await r.exec('npm run build');
    // ...
  },
});
```

### 2. Use Tasks for Reusable Logic

Extract common operations into tasks:

```typescript
// tasks/build.ts
export const buildTask = defineTask({
  label: 'Build',
  exec: 'npm run build',
});

// commands/build.ts
run: async (r) => {
  await r.run(buildTask);
},

// commands/deploy.ts
run: async (r) => {
  await r.run(buildTask);
  await r.run(deployTask);
},
```

### 3. Group Related Activities

Use visual grouping for clarity:

```typescript
run: async (r) => {
  await r.group('Build', { layout: 'sequence' }, async (g) => {
    await g.activity('Compile', () => r.exec('tsc'));
    await g.activity('Bundle', () => r.exec('esbuild'));
  });

  await r.group('Deploy', { layout: 'sequence' }, async (g) => {
    await g.activity('Upload', () => r.exec('upload'));
    await g.activity('Verify', () => r.exec('verify'));
  });
},
```

### 4. Provide Helpful Descriptions

```typescript
context: {
  env: {
    from: 'flag',
    schema: z.enum(['dev', 'staging', 'prod']),
    description: 'Target environment for deployment',
  },
  dryRun: {
    from: 'flag',
    schema: z.boolean().default(false),
    description: 'Preview changes without applying',
  },
},
```

## Related

- [API Reference: defineCommand](../api/define-command.md)
- [Tasks](./tasks.md)
- [Checks](./checks.md)
