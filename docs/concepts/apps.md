# Interactive Apps

pok commands can render fullscreen interactive applications in the terminal using `r.app()`. This enables rich TUI experiences — explorers, dashboards, editors — while keeping the terminal lifecycle managed by the framework.

## How It Works

`r.app()` renders a React component (via OpenTUI) fullscreen in the terminal. The component owns all interactive state through standard React hooks. The command provides data and mutation callbacks as props.

```typescript
export const command = defineCommand({
  label: 'Dashboard',
  run: async (r) => {
    const stats = await loadStats(r.cwd);
    await r.app(DashboardApp, {
      stats,
      onRefresh: () => loadStats(r.cwd),
    });
  },
});
```

## Why React Components?

pok's tabbed UI already uses OpenTUI (React for the terminal). Rather than inventing a new state management protocol, `r.app()` lets you write normal React components:

- **State**: `useState`, `useReducer` — you choose
- **Side effects**: `useEffect` for timers, subscriptions
- **Keyboard**: `useKeyboard` from `@opentui/react`
- **Layout**: JSX with `<box>`, `<text>` — OpenTUI primitives

The component is the interactive session. No action schemas, event protocols, or session reducers needed.

## Separation of Concerns

The key architectural pattern: **the command owns I/O, the component owns UI**.

```typescript
// Command: loads data, provides mutation callbacks
run: async (r) => {
  const tasks = await loadTasks(r.cwd);

  await r.app(TaskExplorer, {
    tasks,
    onUpdate: async (id, fields) => {
      await updateTaskFile(r.cwd, id, fields);
      return loadTasks(r.cwd);
    },
    onDelete: async (id) => {
      await deleteTaskFile(r.cwd, id);
      return loadTasks(r.cwd);
    },
  });
},
```

```typescript
// Component: manages navigation, renders UI, calls callbacks
function TaskExplorer({ tasks: initial, onUpdate, onDelete, onExit }) {
  const [tasks, setTasks] = useState(initial);
  const [cursor, setCursor] = useState(0);

  const handleStatusChange = async (status: string) => {
    const updated = await onUpdate(tasks[cursor].id, { status });
    setTasks(updated);
  };

  // ... keyboard handling, rendering
}
```

This separation means:
- Components are testable (pass mock callbacks)
- File I/O is never scattered across UI code
- The same component works with different data sources

## Multiple Views

Build multi-screen apps using state to track the active view:

```typescript
function MyApp({ data, onExit }: Props) {
  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (view === 'list') {
    return <ListView data={data} onSelect={(id) => { setSelectedId(id); setView('detail'); }} />;
  }
  if (view === 'detail') {
    return <DetailView id={selectedId} onBack={() => setView('list')} onEdit={() => setView('edit')} />;
  }
  if (view === 'edit') {
    return <EditView id={selectedId} onSave={...} onCancel={() => setView('detail')} />;
  }
}
```

## Configuration

Add the app adapter to your `pok.config.ts`:

```typescript
import { defineConfig } from '@pokit/core';
import { createAppAdapter } from '@pokit/opentui';

export default defineConfig({
  app: createAppAdapter(),
  // ...
});
```

## Non-Interactive Fallback

Always consider non-TTY environments (CI, piped output):

```typescript
run: async (r) => {
  const data = await loadData(r.cwd);

  if (!process.stdout.isTTY) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  await r.app(ExplorerApp, { data });
},
```

## Related

- [API: App Adapter](../api/app.md) — Interface and configuration
- [API: Runner](../api/runner.md) — The `r.app()` method
- [Commands](./commands.md) — Command patterns
