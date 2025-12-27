---
title: Understanding Checks
order: 1
category: core-concepts
---

# Understanding Checks

Checks validate that certain conditions are met before a command runs. They help prevent errors and ensure your environment is ready.

## What You'll Learn

- How to define a check
- How to use checks in commands
- Common check patterns

## Step 1: Create a check

Let's create a check that verifies a file exists:

```typescript file="commands/file-exists.check.ts"
import { defineCheck } from '@openpok/core';
import { existsSync } from 'fs';

export default defineCheck({
  meta: {
    name: 'file-exists',
    description: 'Check if a file exists',
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to check',
      required: true,
    },
  },
  run: ({ args }) => {
    const exists = existsSync(args.path);
    return {
      ok: exists,
      message: exists ? `File exists: ${args.path}` : `File not found: ${args.path}`,
    };
  },
});
```

## Step 2: Create a command that uses the check

```typescript file="commands/read-config.ts"
import { defineCommand } from '@openpok/core';
import { readFileSync } from 'fs';

export default defineCommand({
  meta: {
    name: 'read-config',
    description: 'Read a config file',
  },
  pre: [{ check: 'file-exists', args: { path: 'config.json' } }],
  run: () => {
    const content = readFileSync('config.json', 'utf-8');
    console.log('Config:', content);
  },
});
```

## Step 3: Try the command without a config file

```bash
pok read-config
```

The check will fail because `config.json` doesn't exist.

## Step 4: Create the config file and try again

```bash
echo '{"name": "my-app"}' > config.json
```

```bash
pok read-config
```

Now it works!

## Check Return Values

A check must return an object with:

| Property  | Type      | Description               |
| --------- | --------- | ------------------------- |
| `ok`      | `boolean` | Whether the check passed  |
| `message` | `string`  | Status message to display |

## Built-in Check Patterns

Common checks you might create:

- **Environment checks** - Verify env variables are set
- **File checks** - Ensure required files exist
- **Network checks** - Test API connectivity
- **Permission checks** - Verify user access

## Key Points

- Checks are defined with `defineCheck()`
- Check files use the `.check.ts` extension
- Use `pre` array to run checks before a command
- Checks return `{ ok: boolean, message: string }`
- Failed checks stop command execution
