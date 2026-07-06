# Prompter

The `Prompter` interface defines how pok requests interactive input for selects, multiselects, confirms, text fields, and type-ahead autocomplete.

## Prompt surfaces

pok uses a prompter for:

- Select menus (single choice, static or dynamic)
- Multiselect (multiple choices)
- Confirm (yes/no)
- Text input
- Autocomplete (single choice with type-ahead filtering, optional)

## Interface

```typescript
interface Prompter {
  select<T>(options: SelectOptions<T>): Promise<T>;
  multiselect<T>(options: MultiselectOptions<T>): Promise<T[]>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  text(options: TextOptions): Promise<string>;
  /**
   * Single-select with type-ahead filtering. Optional — implementations that
   * don't support it can omit it, and callers should fall back to `select`.
   */
  autocomplete?<T>(options: AutocompleteOptions<T>): Promise<T>;
}
```

## Option Types

### SelectOptions

`select` accepts either a static list of options or a dynamic `provider`.

```typescript
type SelectOption<T> = {
  value: T;
  label: string;
  hint?: string;
  /** Optional group name for visual grouping (like HTML <optgroup>). */
  group?: string;
};

type StaticSelectOptions<T> = {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
};

type DynamicSelectOptions<T> = {
  message: string;
  provider: OptionsProvider<T>;
  initialValue?: T;
  /** Shown while loading initial options. @default "Loading..." */
  loadingMessage?: string;
  /** Shown when the provider fails. @default "Failed to load options" */
  errorMessage?: string;
};

type SelectOptions<T> = StaticSelectOptions<T> | DynamicSelectOptions<T>;
```

### OptionsProvider (dynamic options)

A dynamic provider is a single function that, given the current type-ahead
`filter` and an `AbortSignal`, resolves to the full option set to display. The UI
adapter owns how loading and filtering are presented (debounce, pagination,
server-vs-client filtering are implementation details of the UI, not the
contract).

```typescript
type OptionsProvider<T> = (
  filter: string | undefined,
  signal: AbortSignal
) => Promise<SelectOption<T>[]>;
```

```typescript
const selected = await prompter.select({
  message: 'Select a post',
  provider: async (filter, signal) => {
    const posts = await fetchPosts(filter, { signal });
    return posts.map((p) => ({ value: p.slug, label: p.title, group: p.year }));
  },
});
```

A type guard is exported for narrowing:

```typescript
import { isDynamicOptions } from '@pokit/core';
```

### AutocompleteOptions

```typescript
type AutocompleteOptions<T> = {
  message: string;
  options: SelectOption<T>[];
  placeholder?: string;
  maxItems?: number;
};
```

### MultiselectOptions

```typescript
type MultiselectOption<T> = {
  value: T;
  label: string;
  hint?: string;
  group?: string;
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

## Using @pokit/terminal

The default implementation ships in [@pokit/terminal](../packages/terminal.md), built on clack. It is wired in automatically by the `pok` launcher when your config omits `prompter`. To get an instance directly:

```typescript
import { createTerminalUI } from '@pokit/terminal';

const { prompter } = createTerminalUI();
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

// @pokit/terminal does this internally:
if (p.isCancel(result)) {
  throw new CancelError(); // exitCode: 130
}
```

In interactive menus, the [Navigator](./navigator.md) catches this `CancelError` and
turns it into up-navigation (`back`) rather than aborting the CLI.

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
