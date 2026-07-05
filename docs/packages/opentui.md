# @pokit/opentui

`@pokit/opentui` provides the tab and app adapters for pok. It renders `r.tabs()` and `r.app()` flows with OpenTUI components in the terminal.

## Installation

```bash
bun add @pokit/opentui
```

## Configuration

```typescript
import { defineConfig } from '@pokit/core';
import { createTabsAdapter, createAppAdapter } from '@pokit/opentui';

export default defineConfig({
  tabs: createTabsAdapter(),
  app: createAppAdapter(),
});
```

## Tabs adapter

Use `createTabsAdapter()` with `r.tabs()` to run multiple commands in a tabbed terminal interface.

```typescript
await r.tabs([r.exec('vite'), r.exec('stripe listen')], { name: 'Dev' });
```

## App adapter

Use `createAppAdapter()` with `r.app()` for fullscreen interactive apps.

```typescript
await r.app(MyApp, {
  data: await loadData(r.cwd),
});
```

Your app component can optionally use `onExit?: (code?: number) => void` to close the app.

## Event Adapter

`createEventAdapter(bus, options?)` renders event streams from an `EventBus` and returns `{ unmount() }` for cleanup.
