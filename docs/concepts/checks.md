# Pre-flight Checks Deep Dive

Pre-flight checks validate preconditions before command execution. This guide covers patterns and best practices.

## Purpose

Checks answer the question: "Can this command run successfully?"

- Is Docker running?
- Is the required Node version installed?
- Does the config file exist?
- Is the user authenticated?

## Anatomy of a Check

```typescript
const myCheck = defineCheck({
  label: 'Human-readable description',
  check: async () => {
    // Validation logic
    // Throw an Error with helpful message if check fails
  },
  // Optional: enhanced error information
  errorMessage: 'Custom error message',
  remediation: ['Step 1 to fix', 'Step 2 to fix'],
  documentationUrl: 'https://example.com/docs',
});
```

## Common Patterns

### Command Existence

```typescript
import { commandExists } from '@openpok/core';

export const dockerInstalled = defineCheck({
  label: 'Docker installed',
  check: async () => {
    if (!(await commandExists('docker'))) {
      throw new Error(
        'Docker is not installed.\n' + 'Install from: https://docs.docker.com/get-docker/'
      );
    }
  },
});
```

### Service Running with Remediation

```typescript
export const dockerRunning = defineCheck({
  label: 'Docker running',
  check: async () => {
    const result = await $`docker info`.nothrow().quiet();
    if (result.exitCode !== 0) {
      throw new Error('Docker daemon is not running');
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

### Version Requirements

```typescript
import { getNodeMajorVersion } from '@openpok/core';

export const nodeVersion = defineCheck({
  label: 'Node.js >= 20',
  check: async () => {
    const version = await getNodeMajorVersion();
    if (version < 20) {
      throw new Error(
        `Node.js 20+ is required. Current version: ${version}\n` + 'Use nvm or volta to upgrade.'
      );
    }
  },
});
```

### File Existence

```typescript
import { exists } from 'fs/promises';

export const envFileExists = defineCheck({
  label: '.env file exists',
  check: async () => {
    if (!(await exists('.env'))) {
      throw new Error('.env file not found.\n' + 'Copy .env.example to .env and fill in values.');
    }
  },
});
```

### Authentication

```typescript
export const awsAuthenticated = defineCheck({
  label: 'AWS authenticated',
  check: async () => {
    const result = await $`aws sts get-caller-identity`.nothrow().quiet();
    if (result.exitCode !== 0) {
      throw new Error('Not authenticated with AWS.\n' + 'Run: aws configure sso');
    }
  },
});
```

### Network Connectivity

```typescript
export const canReachApi = defineCheck({
  label: 'API reachable',
  check: async () => {
    try {
      const response = await fetch('https://api.example.com/health');
      if (!response.ok) {
        throw new Error('API returned error');
      }
    } catch {
      throw new Error(
        'Cannot reach API at https://api.example.com\n' +
          'Check your network connection and VPN status.'
      );
    }
  },
});
```

## Using Checks

### Static Checks

```typescript
export const command = defineCommand({
  label: 'Deploy',
  pre: [dockerRunning, awsAuthenticated, envFileExists],
  run: async (r) => {
    // Runs only if all checks pass
  },
});
```

### Single Check

```typescript
export const command = defineCommand({
  label: 'Build',
  pre: nodeVersion,
  run: async (r) => {
    await r.exec('npm run build');
  },
});
```

### Dynamic Checks

Checks that depend on command context:

```typescript
export const command = defineCommand({
  label: 'Deploy',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['staging', 'prod']),
    },
  },
  pre: (ctx) => {
    const checks = [awsAuthenticated];

    if (ctx.env === 'prod') {
      checks.push(prodConfirmation);
      checks.push(cleanGitStatus);
    }

    return checks;
  },
  run: async (r, ctx) => {
    await r.exec(`deploy --env ${ctx.context.env}`);
  },
});
```

### Async Dynamic Checks

```typescript
pre: async (ctx) => {
  const isCI = process.env.CI === 'true';

  if (isCI) {
    return []; // Skip interactive checks in CI
  }

  if (ctx.env === 'prod') {
    return [prodConfirmation];
  }

  return [];
},
```

## Error Messages and Remediation

### Using Remediation Fields (Recommended)

The recommended approach is to use the `errorMessage`, `remediation`, and `documentationUrl` fields. These provide structured error information that renders consistently:

```typescript
export const dockerRunning = defineCheck({
  label: 'Docker running',
  check: async () => {
    const result = await $`docker info`.nothrow().quiet();
    if (result.exitCode !== 0) {
      throw new Error('Docker not running');
    }
  },
  errorMessage: 'Docker daemon is not running',
  remediation: [
    "Start Docker Desktop, or",
    "Run 'sudo systemctl start docker' (Linux)",
  ],
  documentationUrl: 'https://docs.docker.com/get-started/',
});
```

This renders as:

```
┌  Pre-flight Checks
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

### Single Remediation Step

For simple fixes, use a string instead of an array:

```typescript
export const nodeVersion = defineCheck({
  label: 'Node.js >= 20',
  check: async () => {
    const version = await getNodeMajorVersion();
    if (version < 20) {
      throw new Error(`Node.js 20+ required`);
    }
  },
  errorMessage: `Node.js 20+ required (current: ${process.version})`,
  remediation: 'Install Node.js 20+ from https://nodejs.org/',
});
```

### Legacy: Error Message Only

You can still include all information in the error message:

```typescript
throw new Error(
  'Docker is not running.\n\n' +
    'The deployment requires Docker to build container images.\n\n' +
    'To fix:\n' +
    '1. Open Docker Desktop\n' +
    '2. Wait for "Docker is running" status\n' +
    '3. Run this command again'
);
```

## Check Deduplication

When running all children of a parent command, checks are deduplicated:

```typescript
// commands/check.ts
export const command = defineCommand({
  label: 'Run all checks',
  enableRunAllChildren: 'sequential',
});

// commands/check.lint.ts
export const command = defineCommand({
  label: 'Lint',
  pre: [nodeVersion],
  run: async (r) => {
    await r.exec('npm run lint');
  },
});

// commands/check.types.ts
export const command = defineCommand({
  label: 'Types',
  pre: [nodeVersion], // Same check
  run: async (r) => {
    await r.exec('npm run typecheck');
  },
});
```

Running `mycli check all`:

```
◆  Pre-flight Checks
│  ◇  Node.js >= 20    ← Only runs once!

◆  Run all checks
│  ◇  Lint
│  ◇  Types
```

## Composing Checks

### Reusable Check Modules

```typescript
// checks/docker.ts
export const dockerInstalled = defineCheck({ ... });
export const dockerRunning = defineCheck({ ... });
export const dockerCompose = defineCheck({ ... });

// checks/node.ts
export const nodeVersion = defineCheck({ ... });
export const npmInstalled = defineCheck({ ... });

// commands/dev.ts
import { dockerRunning } from '../checks/docker';
import { nodeVersion } from '../checks/node';

export const command = defineCommand({
  pre: [dockerRunning, nodeVersion],
  // ...
});
```

### Check Factories

```typescript
function createVersionCheck(command: string, minVersion: number, label: string) {
  return defineCheck({
    label,
    check: async () => {
      const version = await getVersion(command);
      if (version < minVersion) {
        throw new Error(`${command} ${minVersion}+ required`);
      }
    },
  });
}

export const nodeVersion = createVersionCheck('node', 20, 'Node.js >= 20');
export const bunVersion = createVersionCheck('bun', 1, 'Bun >= 1.0');
```

## Visual Output

### Successful Checks

```
┌  Pre-flight Checks
│
◇  Docker installed
│
◇  Docker running
│
◇  Node.js >= 20
│
└  ✔ Done
```

### Failed Check (Basic)

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

### Failed Check with Remediation

When a check has `remediation` and/or `documentationUrl` defined, they're displayed after the error:

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

## Best Practices

### 1. Fast Checks First

Order checks from fastest to slowest:

```typescript
pre: [
  envFileExists,      // Fast: file check
  nodeVersion,        // Fast: command check
  dockerRunning,      // Medium: daemon check
  awsAuthenticated,   // Slow: network call
],
```

### 2. Specific Error Messages

```typescript
// Good
throw new Error(
  'Cannot connect to PostgreSQL at localhost:5432.\n' +
    'Ensure the database is running: docker compose up -d db'
);

// Bad
throw new Error('Database error');
```

### 3. Skip in CI When Appropriate

```typescript
export const interactiveConfirmation = defineCheck({
  label: 'Deployment confirmed',
  check: async () => {
    if (process.env.CI) {
      return; // Skip in CI
    }
    // Interactive confirmation logic
  },
});
```

### 4. Group Related Checks

```typescript
// All Docker-related checks
const dockerChecks = [dockerInstalled, dockerRunning, dockerCompose];

// All auth checks
const authChecks = [awsAuthenticated, npmAuthenticated];

// Use in commands
pre: [...dockerChecks, ...authChecks],
```

## Related

- [API Reference: defineCheck](../api/define-check.md)
- [Commands](./commands.md)
