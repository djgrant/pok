# @pokit/prompter-clack

Interactive prompts adapter using [@clack/prompts](https://github.com/natemoo-re/clack).

## Installation

```bash
bun add @pokit/prompter-clack
```

## Usage

```typescript
import { run } from '@pokit/core';
import { createPrompter } from '@pokit/prompter-clack';

await run(args, {
  prompter: createPrompter(),
  // ...
});
```

## What It Provides

Beautiful, accessible prompts:

```
◆  mycli
│
◇  What would you like to do?
│  ● build - Build the project
│  ○ deploy - Deploy to environment
│  ○ test - Run tests
│
◇  Select environment
│  ● staging
│  ○ production
│
└  Selected: build → staging
```

## Prompt Types

### Select

Single choice from options:

```
◇  Select environment
│  ● staging
│  ○ production
```

Triggered by enum context fields:

```typescript
context: {
  env: {
    from: 'flag',
    schema: z.enum(['staging', 'production']),
  },
}
```

### Multiselect

Multiple choices:

```
◆  Select features
│  ◼ TypeScript
│  ◻ ESLint
│  ◼ Prettier
```

### Confirm

Yes/no prompt:

```
◇  Deploy to production?
│  ● Yes / ○ No
```

Triggered by boolean context fields:

```typescript
context: {
  force: {
    from: 'flag',
    schema: z.boolean(),
  },
}
```

### Text

Free-form input:

```
◇  Enter project name
│  my-awesome-project
```

Triggered by string context fields:

```typescript
context: {
  name: {
    from: 'flag',
    schema: z.string(),
  },
}
```

## Cancellation

Pressing `Ctrl+C` exits gracefully:

```typescript
if (p.isCancel(result)) {
  process.exit(0);
}
```

## Features

- **Accessible** - Screen reader support
- **Keyboard navigation** - Arrow keys, enter, space
- **Visual feedback** - Spinners, checkmarks, colors
- **Graceful cancellation** - Clean exit on Ctrl+C

## API

### createPrompter

```typescript
function createPrompter(): Prompter;
```

Returns a Prompter implementation using Clack.

## Related

- [API Reference: Prompter](../api/prompter.md)
- [@pokit/core](./core.md)
