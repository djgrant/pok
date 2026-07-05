# App Adapter

The `AppAdapter` interface defines how pok mounts fullscreen terminal applications for `r.app()`.

## Contract

The adapter runs a React component fullscreen in the terminal and manages terminal ownership while it is mounted:

- Your React component takes over the terminal
- Component owns its own state via hooks (useState, useReducer, etc.)
- Keyboard input handled by the component
- Terminal lifecycle managed by the adapter (alternate screen, raw mode, cleanup)

## Interface

```typescript
interface AppAdapter {
  run<TProps>(
    component: AnyComponent<TProps>,
    props: TProps
  ): Promise<void>;
}
```

The app can receive an optional `onExit` callback from the adapter for graceful exit.

## `@pokit/opentui`

```typescript
import { createAppAdapter } from '@pokit/opentui';

const appAdapter = createAppAdapter();

// In pok.config.ts or router config
await run(args, {
  app: appAdapter,
  // ...
});
```

## Command usage

```typescript
import { defineCommand } from '@pokit/core';
import { MyApp } from '../components/my-app';

export const command = defineCommand({
  label: 'Interactive explorer',
  run: async (r) => {
    const data = await loadData(r.cwd);

    await r.app(MyApp, {
      data,
      onSave: async (id, fields) => {
        await saveToFile(r.cwd, id, fields);
        return loadData(r.cwd);
      },
    });
  },
});
```

## Writing App Components

App components are standard React function components rendered by OpenTUI:

```typescript
import { useState, useCallback } from 'react';
import { useKeyboard } from '@opentui/react';

type MyAppProps = {
  data: Item[];
  onSave: (id: string, fields: Partial<Item>) => Promise<Item[]>;
  onExit?: (code?: number) => void;
};

function MyApp({ data: initial, onSave, onExit }: MyAppProps) {
  const [items, setItems] = useState(initial);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboard((event) => {
    if (event.name === 'q') onExit?.();
    if (event.name === 'j') setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    if (event.name === 'k') setSelectedIndex(i => Math.max(i - 1, 0));
  });

  return (
    <box flexDirection="column">
      {items.map((item, i) => (
        <text key={item.id} fg={i === selectedIndex ? '#FFF' : '#888'}>
          {i === selectedIndex ? '▶' : ' '} {item.title}
        </text>
      ))}
      <text fg="#666">j/k navigate · q quit</text>
    </box>
  );
}
```

## Runtime behavior

When `r.app()` is called:

1. **Reporter suspends**: Clack output pauses.
2. **Full-screen mode**: the alternate buffer is activated.
3. **Component renders**: your React component mounts.
4. **User interacts**: keyboard and mouse input go to the component.
5. **App exits**: the component can call `onExit?.()`.
6. **Reporter resumes**: normal command output returns.

## Data Flow

The usual pattern separates data ownership from UI:

| Concern | Who owns it |
|---|---|
| Navigation, cursor, panels | React state in the component |
| Domain data | Props, refreshed via mutation callbacks |
| File I/O, persistence | Callbacks provided by the command |
| Terminal lifecycle | The adapter (automatic) |

```typescript
// Command provides callbacks, so the app never touches disk directly
await r.app(BoardApp, {
  project,
  onUpdate: async (id, fields) => {
    await writeFile(path, updated);     // command owns I/O
    return loadProject(r.cwd);          // return fresh data
  },
});
```

## No Adapter Provided

If `app` is not in router config:

```typescript
await r.app(MyApp, { ... });
// Error: App adapter not available. Please provide an AppAdapter...
```

## Non-TTY Environments

The adapter throws if stdout or stdin are not TTY. For CI or piped environments, guard with a fallback:

```typescript
run: async (r) => {
  if (!process.stdout.isTTY) {
    // Non-interactive fallback
    console.log(JSON.stringify(data));
    return;
  }
  await r.app(MyApp, { data });
},
```

## Custom Adapter

Implement your own adapter:

```typescript
import type { AppAdapter, AnyComponent } from '@pokit/core';

const myAdapter: AppAdapter = {
  async run(component, props) {
    // Set up terminal
    // Render component
    // Wait for the app to exit
    // Restore terminal
  },
};
```
