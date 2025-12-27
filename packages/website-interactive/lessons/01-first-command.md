---
title: Your First Command
order: 1
category: getting-started
---

# Your First Command

Welcome to pok! In this lesson, you'll create your very first CLI command.

## What You'll Learn

- How to create a basic pok command
- The structure of a command file
- How to run your command

## Step 1: Create the command file

Commands in pok are TypeScript files in the `commands/` directory. Let's create a simple "hello" command.

```typescript file="commands/hello.ts"
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'hello',
    description: 'Say hello to pok',
  },
  run: () => {
    console.log('Hello, pok!');
  },
});
```

## Step 2: Run your command

Now let's run the command you just created:

```bash
pok hello
```

## Expected Output

You should see:

```
Hello, pok!
```

## What Just Happened?

1. **defineCommand** - This function creates a command definition that pok understands
2. **meta** - Contains metadata like the command name and description
3. **run** - The function that executes when you run the command

## Next Steps

Congratulations! You've created your first pok command. In the next lesson, we'll add arguments and flags to make commands more powerful.
