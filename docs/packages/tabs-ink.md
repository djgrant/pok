# @pokjs/tabs-ink

Tabbed terminal UI adapter using [Ink](https://github.com/vadimdemedes/ink) (React for CLI).

## Installation

```bash
bun add @pokjs/tabs-ink
```

## Usage

```typescript
import { run } from '@pokjs/core';
import { createTabsAdapter } from '@pokjs/tabs-ink';

await run(args, {
  tabs: createTabsAdapter(),
  // ...
});
```

Then in commands:

```typescript
run: async (r) => {
  await r.tabs([r.exec('npm run dev'), r.exec('stripe listen'), r.run(watchTask)], {
    name: 'Development',
  });
};
```

## What It Provides

A full-screen tabbed terminal interface:

```
┌─────────────────────────────────────────────────────────────┐
│  [1] dev ●  [2] stripe ●  [3] watch ●                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  > vite v5.0.0 dev server running at:                      │
│                                                             │
│    Local:   http://localhost:5173/                         │
│    Network: http://192.168.1.100:5173/                     │
│                                                             │
│  ready in 500ms                                            │
│                                                             │
│  10:30:45 [vite] page reload src/App.tsx                   │
│  10:30:46 [vite] hmr update /src/App.tsx                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
  ← → switch tabs  ↑ ↓ scroll  q quit
```

## Features

- **Full-screen mode** - Uses alternate terminal buffer
- **Tab bar** - Shows all tabs with status indicators
- **Keyboard navigation** - Arrow keys or number keys
- **Scrollable output** - Navigate through buffered output
- **Status indicators** - Running, success, error states
- **Process management** - Lifecycle handling, cleanup

## Keyboard Controls

| Key             | Action                      |
| --------------- | --------------------------- |
| `←` `→`         | Switch to previous/next tab |
| `1-9`           | Switch to tab by number     |
| `↑` `↓`         | Scroll output up/down       |
| `Page Up/Down`  | Scroll by page              |
| `Home/End`      | Scroll to start/end         |
| `q` or `Ctrl+C` | Quit all processes          |

## Status Indicators

| Symbol      | Meaning                     |
| ----------- | --------------------------- |
| `●` (blue)  | Process running             |
| `✓` (green) | Process exited successfully |
| `✗` (red)   | Process exited with error   |
| `○` (gray)  | Process killed              |

## API

### createTabsAdapter

```typescript
function createTabsAdapter(): TabsAdapter;
```

Returns a TabsAdapter that renders using Ink.

### createEventAdapter

For event-driven rendering (advanced):

```typescript
import { createEventAdapter } from '@pokjs/tabs-ink';

const adapter = createEventAdapter({
  eventBus,
  // options
});
```

### useEventBus

React hook for consuming events:

```typescript
import { useEventBus } from '@pokjs/tabs-ink';

function MyComponent({ eventBus }) {
  const state = useEventBus(eventBus);
  // Render based on state
}
```

## Single Process Optimization

When only one process is provided, no tabbed UI is shown:

```typescript
// Just runs with inherited stdio
await r.tabs([r.exec('npm run dev')]);
```

## Process Cleanup

On quit or error:

1. All processes receive SIGTERM
2. UI returns to normal terminal
3. Reporter resumes

## Output Buffering

- Each tab buffers up to 1000 lines
- Oldest lines are dropped when limit reached
- Output is batched (16ms) for performance

## Related

- [@pokjs/tabs-core](./tabs-core.md) - Shared logic
- [API Reference: Tabs](../api/tabs.md)
- [Runner](../api/runner.md) - Using `r.tabs()`
