# @pokit/opentui

OpenTUI-based adapters for tabbed process UIs and fullscreen interactive apps.

## Installation

```bash
bun add @pokit/opentui
```

## Usage

```typescript
import { defineConfig } from '@pokit/core';
import { createTabsAdapter, createAppAdapter } from '@pokit/opentui';

export default defineConfig({
  tabs: createTabsAdapter(),
  app: createAppAdapter(),
});
```

## Tabs Adapter

Use `createTabsAdapter()` with `r.tabs()` to run multiple commands in a tabbed terminal interface.

```typescript
await r.tabs([r.exec('vite'), r.exec('stripe listen')], { name: 'Dev' });
```

## App Adapter

Use `createAppAdapter()` with `r.app()` for fullscreen interactive apps.

```typescript
await r.app(MyApp, {
  data: await loadData(r.cwd),
});
```

Your app component can optionally use `onExit?: (code?: number) => void` to close the app.

## Event Adapter

`createEventAdapter(bus, options?)` renders event streams from an `EventBus` and returns `{ unmount() }` for cleanup.

## Related

- [API: Tabs](../api/tabs.md)
- [API: App](../api/app.md)
- [@pokit/tabs-core](./tabs-core.md)
