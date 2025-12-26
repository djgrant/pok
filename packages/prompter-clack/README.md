# @openpok/prompter-clack

Interactive prompts adapter for pok using [Clack](https://github.com/natemoo-re/clack).

## Installation

```bash
bun add @openpok/prompter-clack
```

## Usage

```typescript
import { run } from '@openpok/core';
import { createPrompter } from '@openpok/prompter-clack';

await run(args, {
  prompter: createPrompter(),
  // ...
});
```

## Features

- Text input prompts
- Password/secret input
- Confirmation prompts
- Select menus (single choice)
- Multi-select menus

## What It Does

When a command defines required context fields that aren't provided via flags, pok uses the prompter to interactively request them:

```typescript
export const command = defineCommand({
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']),
      description: 'Target environment',
    },
  },
  run: async (r, ctx) => {
    // If --env not provided, prompter asks user to select
  },
});
```

```bash
$ mycli deploy
? Select environment > dev / staging / prod
```

## Documentation

See the [full documentation](https://github.com/openpok/pok/blob/main/docs/packages/prompter-clack.md).
