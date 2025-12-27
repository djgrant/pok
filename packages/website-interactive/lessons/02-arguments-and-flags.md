---
title: Arguments and Flags
order: 2
category: getting-started
---

# Arguments and Flags

Commands become more useful when they accept input. Let's add arguments and flags to your commands.

## What You'll Learn

- How to define command arguments
- How to add optional flags
- How to access argument values

## Step 1: Create a greeting command

Let's create a command that greets a person by name:

```typescript file="commands/greet.ts"
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'greet',
    description: 'Greet someone by name',
  },
  args: {
    name: {
      type: 'string',
      description: 'Name of the person to greet',
      required: true,
    },
  },
  run: ({ args }) => {
    console.log(`Hello, ${args.name}!`);
  },
});
```

## Step 2: Run with an argument

```bash
pok greet Alice
```

You should see: `Hello, Alice!`

## Step 3: Add a flag

Now let's add an optional `--loud` flag that makes the greeting uppercase:

```typescript file="commands/greet.ts"
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'greet',
    description: 'Greet someone by name',
  },
  args: {
    name: {
      type: 'string',
      description: 'Name of the person to greet',
      required: true,
    },
    loud: {
      type: 'boolean',
      description: 'Make the greeting loud',
      default: false,
    },
  },
  run: ({ args }) => {
    let message = `Hello, ${args.name}!`;
    if (args.loud) {
      message = message.toUpperCase();
    }
    console.log(message);
  },
});
```

## Step 4: Try the flag

```bash
pok greet Bob --loud
```

You should see: `HELLO, BOB!`

## Argument Types

pok supports these argument types:

| Type      | Description     | Example        |
| --------- | --------------- | -------------- |
| `string`  | Text value      | `--name Alice` |
| `boolean` | True/false flag | `--loud`       |
| `number`  | Numeric value   | `--count 5`    |

## Key Points

- **args** object defines what inputs your command accepts
- **required: true** makes an argument mandatory
- **default** provides a fallback value for optional args
- Access values through the `args` parameter in `run`
