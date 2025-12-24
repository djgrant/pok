# @openpok/tabs-core

Shared logic for tabbed terminal UI adapters. Framework-agnostic types, state management, and process handling.

## Installation

```bash
bun add @openpok/tabs-core
```

This package is typically a dependency of tabs adapter implementations (like `@openpok/tabs-ink`), not installed directly.

## What It Provides

### State Management

Shared state reducer for tabs UI:

```typescript
import { createInitialState, reducer } from '@openpok/tabs-core';

const state = createInitialState();
const newState = reducer(state, { type: 'TAB_SELECT', tabId: 'tab-1' });
```

### Process Manager

Handles spawning and managing tab processes:

```typescript
import { ProcessManager } from '@openpok/tabs-core';

const pm = new ProcessManager({
  onOutput: (tabId, data) => { /* handle output */ },
  onExit: (tabId, code) => { /* handle exit */ },
});

pm.spawn({ id: 'dev', exec: 'npm run dev', cwd, env });
pm.killAll();
```

### Types

```typescript
import type {
  TabStatus,       // 'running' | 'success' | 'error' | 'killed'
  TabProcess,      // Process state
  ActivityNode,    // Event-driven activity
  GroupNode,       // Event-driven group
  EventDrivenState,// Full UI state
} from '@openpok/tabs-core';
```

### Status Indicators

```typescript
import { STATUS_INDICATORS, getStatusIndicator } from '@openpok/tabs-core';

// STATUS_INDICATORS = {
//   running: '●',
//   success: '✓',
//   error: '✗',
//   killed: '○',
// }

const indicator = getStatusIndicator('running'); // '●'
```

## State Shape

```typescript
type EventDrivenState = {
  tabs: TabProcess[];
  activeTab: number;
  scrollOffset: number;
};

type TabProcess = {
  id: string;
  label: string;
  exec: string;
  status: TabStatus;
  output: string[];
  exitCode: number | null;
};
```

## Actions

```typescript
type Action =
  | { type: 'TAB_ADD'; tab: TabProcess }
  | { type: 'TAB_SELECT'; index: number }
  | { type: 'TAB_OUTPUT'; tabId: string; lines: string[] }
  | { type: 'TAB_EXIT'; tabId: string; code: number }
  | { type: 'SCROLL'; offset: number };
```

## Process Manager API

```typescript
class ProcessManager {
  constructor(callbacks: ProcessManagerCallbacks);
  
  spawn(spec: TabSpec & { id: string; cwd: string; env: Record<string, string> }): void;
  kill(id: string): void;
  killAll(): void;
  isRunning(id: string): boolean;
}
```

## Constants

```typescript
// Maximum output lines to keep per tab
const MAX_OUTPUT_LINES = 1000;

// Output batching interval
const OUTPUT_BATCH_MS = 16;
```

## Usage in Adapter

```typescript
import {
  createInitialState,
  reducer,
  ProcessManager,
} from '@openpok/tabs-core';

function createTabsAdapter(): TabsAdapter {
  return {
    async run(items, options) {
      let state = createInitialState();
      
      const pm = new ProcessManager({
        onOutput: (tabId, data) => {
          state = reducer(state, { type: 'TAB_OUTPUT', tabId, lines: [data] });
          render(state);
        },
        onExit: (tabId, code) => {
          state = reducer(state, { type: 'TAB_EXIT', tabId, code });
          render(state);
        },
      });
      
      // Spawn processes
      for (const item of items) {
        pm.spawn({ ...item, cwd: options.cwd, env: options.env });
      }
      
      // Wait for completion
      await waitForExit(pm);
    },
  };
}
```

## Related

- [@openpok/tabs-ink](./tabs-ink.md) - Ink implementation
- [API Reference: Tabs](../api/tabs.md)
