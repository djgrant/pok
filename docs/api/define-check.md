# defineCheck

Defines a pre-flight check that validates preconditions before command execution.

## Import

```typescript
import { defineCheck } from '@openpok/core';
```

## Signature

```typescript
function defineCheck(config: CheckConfig): CheckConfig;

type CheckConfig = {
  label: string;
  check: () => Promise<void> | void;
  errorMessage?: string;
  remediation?: string | string[];
  documentationUrl?: string;
};
```

## Configuration

| Property           | Type                          | Description                                           |
| ------------------ | ----------------------------- | ----------------------------------------------------- |
| `label`            | `string`                      | Human-readable label for logging                      |
| `check`            | `() => void \| Promise<void>` | Validation function that throws on failure            |
| `errorMessage`     | `string`                      | Custom error message (replaces default thrown error)  |
| `remediation`      | `string \| string[]`          | Fix instructions shown when check fails               |
| `documentationUrl` | `string`                      | Link to documentation for more information            |

## Examples

### Basic Check

```typescript
import { defineCheck } from '@openpok/core';
import { commandExists } from '@openpok/core';

export const dockerInstalled = defineCheck({
  label: 'Docker installed',
  check: async () => {
    const exists = await commandExists('docker');
    if (!exists) {
      throw new Error('Docker is not installed. Please install Docker Desktop.');
    }
  },
});
```

### Check with Remediation Steps

```typescript
import { defineCheck } from '@openpok/core';
import { $ } from 'bun';

export const dockerRunning = defineCheck({
  label: 'Docker running',
  check: async () => {
    const result = await $`docker info`.nothrow().quiet();
    if (result.exitCode !== 0) {
      throw new Error('Docker is not running');
    }
  },
  errorMessage: 'Docker daemon is not running',
  remediation: [
    "Start Docker Desktop, or",
    "Run 'sudo systemctl start docker' (Linux)",
    "Run 'open -a Docker' (macOS)",
  ],
  documentationUrl: 'https://docs.docker.com/get-started/',
});
```

### Check with Single Remediation

```typescript
import { defineCheck } from '@openpok/core';

export const dockerInstalled = defineCheck({
  label: 'Docker installed',
  check: async () => {
    const exists = await commandExists('docker');
    if (!exists) {
      throw new Error('Docker not found');
    }
  },
  errorMessage: 'Docker is not installed',
  remediation: 'Install Docker from https://docs.docker.com/get-docker/',
  documentationUrl: 'https://docs.docker.com/get-docker/',
});
```

### Check Node Version

```typescript
import { defineCheck, getNodeMajorVersion } from '@openpok/core';

export const nodeVersion = defineCheck({
  label: 'Node.js >= 18',
  check: async () => {
    const version = await getNodeMajorVersion();
    if (version < 18) {
      throw new Error(`Node.js 18+ required. Current: ${version}`);
    }
  },
});
```

### Check File Exists

```typescript
import { defineCheck } from '@openpok/core';
import { exists } from 'fs/promises';

export const envFileExists = defineCheck({
  label: '.env file exists',
  check: async () => {
    if (!(await exists('.env'))) {
      throw new Error('.env file not found. Copy .env.example to .env and fill in values.');
    }
  },
});
```

## Using Checks

### Static Checks

```typescript
import { defineCommand } from '@openpok/core';
import { dockerRunning, nodeVersion } from './checks';

export const command = defineCommand({
  label: 'Start development',
  pre: [dockerRunning, nodeVersion],
  run: async (r) => {
    await r.exec('docker compose up');
  },
});
```

### Single Check

```typescript
export const command = defineCommand({
  label: 'Build',
  pre: nodeVersion, // Single check (not array)
  run: async (r) => {
    await r.exec('npm run build');
  },
});
```

### Dynamic Checks (Hook Function)

Checks can depend on the resolved context:

```typescript
import { defineCommand, defineCheck } from '@openpok/core';
import { z } from 'zod';

const prodConfirmation = defineCheck({
  label: 'Production deployment confirmed',
  check: async () => {
    // In a real app, you might prompt for confirmation
    const confirmed = process.env.CONFIRM_PROD === 'true';
    if (!confirmed) {
      throw new Error('Production deployment requires CONFIRM_PROD=true');
    }
  },
});

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
      return [prodConfirmation];
    }
    return [];
  },
  run: async (r, ctx) => {
    await r.exec(`deploy --env ${ctx.context.env}`);
  },
});
```

### Returning Checks from Hook

The hook function can return:

- `void` - No checks
- `CheckConfig` - Single check
- `CheckConfig[]` - Multiple checks
- `Promise<...>` - Async versions of above

```typescript
pre: async (ctx) => {
  const checks: CheckConfig[] = [];

  if (ctx.env === 'prod') {
    checks.push(prodConfirmation);
  }

  if (ctx.useDocker) {
    checks.push(dockerRunning);
  }

  return checks;
},
```

## Check Execution

When checks are executed:

1. They run in a "Pre-flight Checks" group with visual spinners
2. Each check's label is displayed with a spinner
3. On success, a checkmark appears
4. On failure, execution stops and the error message is shown
5. If remediation steps are defined, they're displayed after the error
6. If a documentation URL is provided, it's shown for more information

### Basic Failure

```
┌  Pre-flight Checks
│
◇  Docker installed
│
■  Docker running
│
└  ✘ Failed

Error: Docker is not running
```

### Failure with Remediation

```
┌  Pre-flight Checks
│
◇  Docker installed
│
■  Docker running
│     Docker daemon is not running
│     
│     To fix:
│       - Start Docker Desktop, or
│       - Run 'sudo systemctl start docker' (Linux)
│     
│     More info: https://docs.docker.com/get-started/
│
└  ✘ Failed
```

## Deduplication

When running all children of a parent command, checks are deduplicated by reference:

```typescript
// Both commands use dockerRunning
// commands/dev.ts
pre: [dockerRunning, nodeVersion],

// commands/build.ts
pre: [dockerRunning],

// Running "all" only executes dockerRunning once
```

## Shell Utilities

pok exports utilities for common checks:

```typescript
import {
  commandExists, // Check if command is in PATH
  getVersion, // Get version of a command
  getNodeMajorVersion,
  getPackageManager,
} from '@openpok/core';
```

## Related

- [defineCommand](./define-command.md) - Using checks in commands
- [Architecture](../architecture.md) - Check execution flow
