# Prompter

The Prompter interface defines the contract for interactive user input.

## Overview

pok uses a Prompter for interactive input:

- Select menus (single choice)
- Multiselect (multiple choices)
- Confirm (yes/no)
- Text input

## Interface

```typescript
interface Prompter {
  select<T>(options: SelectOptions<T>): Promise<T>;
  multiselect<T>(options: MultiselectOptions<T>): Promise<T[]>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  text(options: TextOptions): Promise<string>;
}
```

## Option Types

### SelectOptions

```typescript
type SelectOption<T> = {
  value: T;
  label: string;
  hint?: string;
};

type SelectOptions<T> = {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
};
```

### MultiselectOptions

```typescript
type MultiselectOption<T> = {
  value: T;
  label: string;
  hint?: string;
};

type MultiselectOptions<T> = {
  message: string;
  options: MultiselectOption<T>[];
  initialValues?: T[];
  required?: boolean;
};
```

### ConfirmOptions

```typescript
type ConfirmOptions = {
  message: string;
  initialValue?: boolean;
};
```

### TextOptions

```typescript
type TextOptions = {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
};
```

## Using @openpok/prompter-clack

The recommended implementation uses [@clack/prompts](https://github.com/natemoo-re/clack):

```typescript
import { createPrompter } from '@openpok/prompter-clack';

const prompter = createPrompter();

// Use in router config
await run(args, {
  prompter,
  // ...
});
```

## Context Resolution

pok automatically prompts for missing required context:

```typescript
defineCommand({
  context: {
    // Enum → Select menu
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']),
    },

    // Boolean → Confirm prompt
    verbose: {
      from: 'flag',
      schema: z.boolean(),
    },

    // String → Text input
    name: {
      from: 'flag',
      schema: z.string(),
    },
  },
  run: async (r, ctx) => {
    // All values resolved
  },
});
```

When flags are missing:

```bash
$ mycli deploy
? Select environment › dev / staging / prod
? Verbose mode? › yes / no
? Enter name: _
```

## Default Values

Fields with defaults don't prompt:

```typescript
env: {
  from: 'flag',
  schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
}
// Only prompts if --env not provided and no default behavior wanted
```

## Raw Prompter (Testing)

For testing, use the raw prompter that accepts pre-defined responses:

```typescript
import { createRawPrompter } from '@openpok/core';

const prompter = createRawPrompter({
  responses: [
    { type: 'select', value: 'staging' },
    { type: 'confirm', value: true },
    { type: 'text', value: 'my-name' },
  ],
});

// Use in tests
await run(['deploy'], {
  prompter,
  // ...
});
```

### Response Provider

For dynamic responses:

```typescript
const prompter = createRawPrompter({
  responseProvider: (call) => {
    if (call.type === 'select' && call.message.includes('environment')) {
      return 'staging';
    }
    if (call.type === 'confirm') {
      return true;
    }
    return 'default';
  },
});
```

## Cancellation

When the user cancels (Ctrl+C), implementations should exit gracefully:

```typescript
// @openpok/prompter-clack handles this:
if (p.isCancel(result)) {
  process.exit(0);
}
```

## Custom Prompter

Implement your own prompter:

```typescript
import type { Prompter } from '@openpok/core';

const myPrompter: Prompter = {
  async select(options) {
    // Your implementation
    return selectedValue;
  },

  async multiselect(options) {
    // Your implementation
    return selectedValues;
  },

  async confirm(options) {
    // Your implementation
    return true;
  },

  async text(options) {
    // Your implementation
    return inputText;
  },
};
```

## Related

- [Router](./router.md) - Using the prompter
- [defineCommand](./define-command.md) - Context that triggers prompts
- [@openpok/prompter-clack](../packages/prompter-clack.md) - Clack implementation
