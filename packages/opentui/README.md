# @pokit/opentui

OpenTUI adapters for `pok` tabbed execution and fullscreen interactive apps.

## Installation

```bash
bun add @pokit/opentui
```

## Usage

```ts
import { defineConfig } from '@pokit/core';
import { createTabsAdapter, createAppAdapter } from '@pokit/opentui';

export default defineConfig({
  tabs: createTabsAdapter(),
  app: createAppAdapter(),
});
```

## Exports

- `createTabsAdapter()`
- `createEventAdapter(bus, options?)`
- `createAppAdapter()`

See docs: `docs/packages/opentui.md`.
