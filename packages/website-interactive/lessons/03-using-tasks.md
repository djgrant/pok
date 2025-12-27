---
title: Using Tasks
order: 3
category: getting-started
---

# Using Tasks

Tasks are reusable pieces of work that can be shared between commands. They help you organize complex operations.

## What You'll Learn

- How to define a task
- How to use tasks in commands
- How tasks promote code reuse

## Step 1: Create a task

Let's create a task that formats a timestamp:

```typescript file="commands/format-time.task.ts"
import { defineTask } from '@openpok/core';

export default defineTask({
  meta: {
    name: 'format-time',
    description: 'Format a timestamp',
  },
  args: {
    format: {
      type: 'string',
      description: 'Time format',
      default: 'short',
    },
  },
  run: ({ args }) => {
    const now = new Date();
    if (args.format === 'short') {
      return now.toLocaleTimeString();
    }
    return now.toISOString();
  },
});
```

## Step 2: Use the task in a command

Now create a command that uses this task:

```typescript file="commands/show-time.ts"
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'show-time',
    description: 'Display the current time',
  },
  args: {
    iso: {
      type: 'boolean',
      description: 'Show ISO format',
      default: false,
    },
  },
  run: async ({ args, tasks }) => {
    const format = args.iso ? 'iso' : 'short';
    const time = await tasks['format-time']({ format });
    console.log(`Current time: ${time}`);
  },
});
```

## Step 3: Run the command

```bash
pok show-time
```

Try with ISO format:

```bash
pok show-time --iso
```

## Why Use Tasks?

Tasks are useful when you need to:

- **Reuse logic** across multiple commands
- **Test functionality** in isolation
- **Compose complex workflows** from smaller pieces

## Task Naming Convention

Task files should end with `.task.ts`:

```
commands/
  my-command.ts          # A command
  my-command.helper.task.ts   # A task for my-command
  shared.task.ts         # A shared task
```

## Key Points

- Tasks are defined with `defineTask()`
- Task files use the `.task.ts` extension
- Access tasks via `tasks['task-name']` in your command's run function
- Tasks can have their own arguments
- Tasks return values that commands can use
