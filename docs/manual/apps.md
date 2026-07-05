# Interactive Apps

pok commands can render fullscreen terminal applications with `r.app()`. The command loads data and mutations, the adapter mounts a React component, and the component owns interactive state inside the terminal session.

## Execution model

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

pok's tabbed UI already uses OpenTUI. `r.app()` uses that same stack and passes control to a normal React component:

- **State**: `useState` or `useReducer`
- **Side effects**: `useEffect` for timers, subscriptions
- **Keyboard**: `useKeyboard` from `@opentui/react`
- **Layout**: JSX with `<box>` and `<text>` from OpenTUI

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

This separation keeps components testable, keeps file I/O out of UI code, and lets the same component run against different data sources.

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

## Non-TTY path

If the command can run without a TTY, branch explicitly and return plain output:

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
