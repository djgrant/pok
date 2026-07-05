# Prompter

The `Prompter` interface defines how pok requests interactive input for selects, multiselects, confirms, and text fields.

## Prompt surfaces

pok uses a prompter for:

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

## Using @pokit/prompter-clack

The recommended implementation uses [@clack/prompts](https://github.com/natemoo-re/clack):

```typescript
import { createPrompter } from '@pokit/prompter-clack';

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
import { createRawPrompter } from '@pokit/core';

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

When the user cancels (Ctrl+C / Esc), implementations should throw a cancellation
error that can be handled by the caller:

```typescript
import { CancelError } from '@pokit/core';

// @pokit/prompter-clack does this internally:
if (p.isCancel(result)) {
  throw new CancelError(); // exitCode: 130
}
```

## Custom Prompter

Implement your own prompter:

```typescript
import type { Prompter } from '@pokit/core';

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
