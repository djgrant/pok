# Building Interactive Apps with pok

This guide walks through building a fullscreen interactive TUI application using `r.app()`. We'll use a task management explorer (similar to Linear) as the running example — but the patterns apply to any interactive app: dashboards, file browsers, data editors, etc.

## Setup

### 1. Install dependencies

Your app needs `@pokit/core` and an OpenTUI-based adapter:

```bash
bun add @pokit/core @pokit/opentui @opentui/core @opentui/react react
```

### 2. Configure the adapter

In your `pok.config.ts`:

```typescript
import { defineConfig } from '@pokit/core';
import { createTabsAdapter, createAppAdapter } from '@pokit/opentui';

export default defineConfig({
  tabs: createTabsAdapter(),
  app: createAppAdapter(),
  // ...
});
```

## Architecture

The core pattern: **commands own data, components own UI**.

```
┌─────────────────────────────────────────────────┐
│ Command (run function)                          │
│                                                 │
│  ┌─────────────┐    ┌────────────────────────┐  │
│  │ Load data   │───▶│ r.app(Component, {     │  │
│  │ from disk   │    │   data,                │  │
│  └─────────────┘    │   onUpdate: write,     │  │
│                     │   (optional) onExit     │  │
│  ┌─────────────┐    │ })                     │  │
│  │ Write data  │◀───│                        │  │
│  │ to disk     │    └────────────────────────┘  │
│  └─────────────┘                                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Component (React)                               │
│                                                 │
│  useState: cursor, selectedId, activeView       │
│  useKeyboard: navigation, shortcuts             │
│  callbacks: props.onUpdate, props.onExit        │
│                                                 │
│  Renders: <box>, <text> via OpenTUI             │
└─────────────────────────────────────────────────┘
```

The component never reads or writes files. It receives data as props and calls callbacks to mutate. Callbacks return fresh data so the component can update its state.

## Step-by-Step: Task Explorer

### Step 1: Data Layer

Define your domain types and file I/O:

```typescript
// lib/types.ts
type Task = {
  id: string;
  title: string;
  status: 'backlog' | 'in-progress' | 'done';
  body: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
};

type Project = {
  tasks: Task[];
};
```

```typescript
// lib/data.ts
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';

export async function loadProject(cwd: string): Promise<Project> {
  const dir = join(cwd, 'tasks');
  const files = await readdir(dir);
  const tasks = await Promise.all(
    files.filter(f => f.endsWith('.md')).map(async (file) => {
      const content = await readFile(join(dir, file), 'utf-8');
      const { data, content: body } = matter(content);
      return { id: file.replace('.md', ''), ...data, body } as Task;
    })
  );
  return { tasks };
}

export async function updateTask(cwd: string, id: string, fields: Partial<Task>): Promise<Project> {
  const file = join(cwd, 'tasks', `${id}.md`);
  const content = await readFile(file, 'utf-8');
  const { data, content: body } = matter(content);
  const updated = { ...data, ...fields };
  const newBody = fields.body ?? body;
  await writeFile(file, matter.stringify(newBody, updated));
  return loadProject(cwd);
}
```

### Step 2: The Command

```typescript
// commands/board.ts
import { defineCommand } from '@pokit/core';
import { loadProject, updateTask } from '../lib/data';
import { BoardApp } from '../components/board-app';

export const command = defineCommand({
  label: 'Task board',
  run: async (r) => {
    const project = await loadProject(r.cwd);

    await r.app(BoardApp, {
      project,
      onUpdateTask: (id, fields) => updateTask(r.cwd, id, fields),
    });
  },
});
```

That's it for the command. All the complexity lives in the component.

### Step 3: The App Component

```tsx
// components/board-app.tsx
import { useState, useCallback } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { Project, Task } from '../lib/types';

type BoardAppProps = {
  project: Project;
  onUpdateTask: (id: string, fields: Partial<Task>) => Promise<Project>;
  onExit?: (code?: number) => void;
};

type View = 'board' | 'detail';

const STATUSES = ['backlog', 'in-progress', 'done'] as const;

export function BoardApp({ project: initial, onUpdateTask, onExit }: BoardAppProps) {
  const [project, setProject] = useState(initial);
  const [view, setView] = useState<View>('board');
  const [cursor, setCursor] = useState({ col: 0, row: 0 });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { height } = useTerminalDimensions();

  // Group tasks by status
  const columns = STATUSES.map(status => ({
    status,
    tasks: project.tasks.filter(t => t.status === status),
  }));

  const taskAtCursor = columns[cursor.col]?.tasks[cursor.row];

  const handleStatusChange = useCallback(async (task: Task, status: string) => {
    const updated = await onUpdateTask(task.id, { status });
    setProject(updated);
  }, [onUpdateTask]);

  useKeyboard((event) => {
    const { name } = event;

    if (view === 'board') {
      if (name === 'q') return onExit?.();
      if (name === 'j') setCursor(c => ({ ...c, row: Math.min(c.row + 1, (columns[c.col]?.tasks.length ?? 1) - 1) }));
      if (name === 'k') setCursor(c => ({ ...c, row: Math.max(c.row - 1, 0) }));
      if (name === 'h') setCursor(c => ({ ...c, col: Math.max(c.col - 1, 0), row: 0 }));
      if (name === 'l') setCursor(c => ({ ...c, col: Math.min(c.col + 1, STATUSES.length - 1), row: 0 }));
      if (name === 'return' && taskAtCursor) {
        setSelectedTask(taskAtCursor);
        setView('detail');
      }
      // Quick status shortcuts
      if (name === '1' && taskAtCursor) handleStatusChange(taskAtCursor, 'backlog');
      if (name === '2' && taskAtCursor) handleStatusChange(taskAtCursor, 'in-progress');
      if (name === '3' && taskAtCursor) handleStatusChange(taskAtCursor, 'done');
    }

    if (view === 'detail') {
      if (name === 'escape') setView('board');
    }
  });

  if (view === 'detail' && selectedTask) {
    return <TaskDetail task={selectedTask} onBack={() => setView('board')} />;
  }

  return (
    <box flexDirection="column" padding={1}>
      <text fg="#FFF">Task Board — {project.tasks.length} tasks</text>
      <box flexDirection="row" gap={2}>
        {columns.map((col, colIdx) => (
          <box key={col.status} flexDirection="column" width="33%">
            <text fg="#00FFFF">{col.status} ({col.tasks.length})</text>
            {col.tasks.map((task, rowIdx) => {
              const active = cursor.col === colIdx && cursor.row === rowIdx;
              return (
                <text key={task.id} fg={active ? '#FFF' : '#888'}>
                  {active ? '▶' : ' '} {task.title}
                </text>
              );
            })}
          </box>
        ))}
      </box>
      <text fg="#666">h/j/k/l navigate · Enter open · 1-3 set status · q quit</text>
    </box>
  );
}

function TaskDetail({ task, onBack }: { task: Task; onBack: () => void }) {
  return (
    <box flexDirection="column" padding={1}>
      <text fg="#00FFFF">{task.title}</text>
      <text fg="#888">Status: {task.status} · Priority: {task.priority ?? 'none'}</text>
      <text>{task.body}</text>
      <text fg="#666">Esc to go back</text>
    </box>
  );
}
```

### Step 4: Non-TTY Fallback

Always handle non-interactive environments:

```typescript
// commands/board.ts
export const command = defineCommand({
  label: 'Task board',
  run: async (r) => {
    const project = await loadProject(r.cwd);

    if (!process.stdout.isTTY) {
      // CI / piped output — print a summary
      for (const task of project.tasks) {
        console.log(`[${task.status}] ${task.title}`);
      }
      return;
    }

    await r.app(BoardApp, {
      project,
      onUpdateTask: (id, fields) => updateTask(r.cwd, id, fields),
    });
  },
});
```

## Patterns

### Mutation + Refresh

Callbacks should perform the mutation and return fresh data. The component updates its state with the result:

```typescript
// In the command
onUpdateTask: async (id, fields) => {
  await writeTaskFile(cwd, id, fields);   // persist
  return loadProject(cwd);                // reload all
},

// In the component
const handleSave = async () => {
  const updated = await props.onUpdateTask(task.id, editedFields);
  setProject(updated);    // refresh UI
  setView('detail');      // navigate
};
```

### Optimistic Updates

For snappy UIs, update state immediately and reconcile:

```typescript
const handleStatusChange = async (task: Task, newStatus: string) => {
  // Optimistic: update UI immediately
  setProject(prev => ({
    ...prev,
    tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t),
  }));

  // Persist and reconcile with actual data
  const actual = await props.onUpdateTask(task.id, { status: newStatus });
  setProject(actual);
};
```

### Error Handling

Show errors in the UI rather than crashing:

```typescript
const [error, setError] = useState<string | null>(null);

const handleSave = async () => {
  try {
    setError(null);
    const updated = await props.onUpdateTask(task.id, fields);
    setProject(updated);
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Save failed');
  }
};

// In render:
{error && <text fg="#FF0000">Error: {error}</text>}
```

### Multi-View Navigation

Use a state machine pattern for views:

```typescript
type View =
  | { screen: 'board' }
  | { screen: 'detail'; taskId: string }
  | { screen: 'edit'; taskId: string }
  | { screen: 'comments'; taskId: string };

const [view, setView] = useState<View>({ screen: 'board' });

// Navigate
setView({ screen: 'detail', taskId: task.id });
setView({ screen: 'edit', taskId: task.id });
setView({ screen: 'board' });
```

### Keyboard Shortcuts

Use `useKeyboard` from `@opentui/react`. Scope shortcuts to the active view:

```typescript
useKeyboard((event) => {
  // Global shortcuts
  if (event.name === 'q' && event.ctrl) return props.onExit?.();

  // View-specific shortcuts
  switch (view.screen) {
    case 'board':
      if (event.name === 'j') moveCursorDown();
      if (event.name === 'k') moveCursorUp();
      if (event.name === 'return') openDetail();
      break;
    case 'detail':
      if (event.name === 'escape') goToBoard();
      if (event.name === 'e') goToEdit();
      break;
    case 'edit':
      if (event.name === 'escape') goToDetail();
      break;
  }
});
```

## Testing Components

Since components receive everything via props, they're straightforward to test:

```typescript
import { render } from '@opentui/test-utils';

it('renders task list', () => {
  const project = {
    tasks: [
      { id: '1', title: 'Fix bug', status: 'backlog', body: '' },
      { id: '2', title: 'Add feature', status: 'in-progress', body: '' },
    ],
  };

  const { getByText } = render(
    <BoardApp
      project={project}
      onUpdateTask={async () => project}
    />
  );

  expect(getByText('Fix bug')).toBeDefined();
  expect(getByText('Add feature')).toBeDefined();
});
```

## OpenTUI Primitives Quick Reference

| Element | Usage |
|---|---|
| `<box>` | Container with flexbox layout |
| `<text>` | Text with color (`fg`, `bg`) |
| `<box border="single">` | Bordered container |
| `<box flexDirection="row">` | Horizontal layout |
| `<box flexDirection="column">` | Vertical layout |
| `<box gap={1}>` | Spacing between children |
| `<box padding={1}>` | Internal padding |
| `<box width="50%">` | Percentage width |
| `useKeyboard(handler)` | Keyboard input |
| `useTerminalDimensions()` | Terminal size |

## Related

- [API: App Adapter](../api/app.md)
- [API: Runner](../api/runner.md)
- [Concepts: Interactive Apps](../concepts/apps.md)
