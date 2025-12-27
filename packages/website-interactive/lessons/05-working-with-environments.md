---
title: Working with Environments
order: 2
category: core-concepts
---

# Working with Environments

Environments let you define different configurations for development, staging, production, and more.

## What You'll Learn

- How to define environments
- How to use environment-specific values
- Switching between environments

## Step 1: Create environments

Let's define development and production environments:

```typescript file="commands/env.dev.ts"
import { defineEnv } from '@openpok/core';

export default defineEnv({
  meta: {
    name: 'dev',
    description: 'Development environment',
  },
  values: {
    apiUrl: 'http://localhost:3000',
    debug: true,
    logLevel: 'verbose',
  },
});
```

```typescript file="commands/env.prod.ts"
import { defineEnv } from '@openpok/core';

export default defineEnv({
  meta: {
    name: 'prod',
    description: 'Production environment',
  },
  values: {
    apiUrl: 'https://api.example.com',
    debug: false,
    logLevel: 'error',
  },
});
```

## Step 2: Create a command that uses environment values

```typescript file="commands/show-config.ts"
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'show-config',
    description: 'Show current configuration',
  },
  run: ({ env }) => {
    console.log('Current Environment Configuration:');
    console.log(`  API URL: ${env.apiUrl}`);
    console.log(`  Debug: ${env.debug}`);
    console.log(`  Log Level: ${env.logLevel}`);
  },
});
```

## Step 3: Run with different environments

Run with development environment (default):

```bash
pok show-config --env dev
```

Run with production environment:

```bash
pok show-config --env prod
```

## Environment File Naming

Environment files follow the pattern `env.<name>.ts`:

```
commands/
  env.dev.ts      # Development
  env.staging.ts  # Staging
  env.prod.ts     # Production
```

## Dynamic Environment Values

Environments can also compute values dynamically:

```typescript
export default defineEnv({
  meta: { name: 'dynamic' },
  values: {
    timestamp: () => new Date().toISOString(),
    randomId: () => Math.random().toString(36).slice(2),
  },
});
```

## Key Points

- Environments are defined with `defineEnv()`
- Environment files use the `env.<name>.ts` pattern
- Access env values via the `env` parameter in `run`
- Switch environments with the `--env` flag
- Environment values can be static or dynamic (functions)
