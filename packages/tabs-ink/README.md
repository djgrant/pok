# @pokit/tabs-ink

Tabbed terminal UI adapter for pok using [Ink](https://github.com/vadimdemedes/ink).

## Installation

```bash
bun add @pokit/tabs-ink
```

## Usage

```typescript
import { run } from '@pokit/core';
import { createTabsAdapter } from '@pokit/tabs-ink';

await run(args, {
  tabs: createTabsAdapter(),
  // ...
});
```

In commands:

```typescript
run: async (r) => {
  await r.tabs([r.exec('npm run dev'), r.exec('stripe listen')], { name: 'Development' });
};
```

## Features

- Full-screen tabbed interface
- Keyboard navigation (arrow keys, numbers)
- Scrollable output per tab
- Process lifecycle management
- Status indicators (running, success, error)

## Documentation

See the [full documentation](https://github.com/openpok/pok/blob/main/docs/packages/tabs-ink.md).
