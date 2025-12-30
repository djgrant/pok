# Tabs Adapter

The TabsAdapter interface defines the contract for tabbed terminal UI implementations.

## Overview

The tabs adapter enables `r.tabs()` to run multiple commands in a tabbed interface:

- Each tab shows buffered output
- Keyboard navigation between tabs
- Scrollable output history
- Process lifecycle management

## Interface

```typescript
interface TabsAdapter {
  run(items: TabSpec[], options: TabsOptions): Promise<void>;
}

type TabSpec = {
  label: string;
  exec: string;
};

type TabsOptions = {
  name: string;
  cwd: string;
  env: Record<string, string | undefined>;
};
```

## Using @pokjs/tabs-ink

The recommended implementation uses [Ink](https://github.com/vadimdemedes/ink) (React for CLI):

```typescript
import { createTabsAdapter } from '@pokjs/tabs-ink';

const tabsAdapter = createTabsAdapter();

// Use in router config
await run(args, {
  tabs: tabsAdapter,
  // ...
});
```

## Usage in Commands

```typescript
run: async (r) => {
  await r.tabs([r.exec('npm run dev'), r.exec('npm run watch:css'), r.exec('stripe listen')], {
    name: 'Development',
  });
};
```

### With Tasks

```typescript
run: async (r) => {
  await r.tabs([r.run(devServerTask), r.run(watcherTask), r.exec('stripe listen')], {
    name: 'Development',
  });
};
```

## Tab Labels

Labels are derived from:

1. **Commands**: First word of the command

   ```typescript
   r.exec('npm run dev'); // Label: "npm"
   r.exec('stripe listen'); // Label: "stripe"
   ```

2. **Tasks with shortLabel**: The `shortLabel` property

   ```typescript
   defineTask({
     label: 'Development Server',
     shortLabel: 'dev', // Tab shows "dev"
     exec: 'npm run dev',
   });
   ```

3. **Tasks without shortLabel**: First word of exec or label

## Behavior

When `r.tabs()` is called:

1. **Reporter suspends** - Clack output pauses
2. **Full-screen mode** - Alternate buffer activated
3. **Processes spawn** - All commands start
4. **UI renders** - Tab bar + output area
5. **User interacts** - Switch tabs, scroll
6. **Processes complete** - Exit when all done or any fails
7. **Reporter resumes** - Returns to normal output

## Single Item Optimization

With a single item, no tabbed UI is shown:

```typescript
// Just runs directly with inherited stdio
await r.tabs([r.exec('npm run dev')]);
```

## Keyboard Controls

The Ink adapter provides:

| Key              | Action        |
| ---------------- | ------------- |
| `←` `→` or `1-9` | Switch tabs   |
| `↑` `↓`          | Scroll output |
| `q` or `Ctrl+C`  | Quit          |

## Error Handling

If a process fails:

- Tab status shows error indicator
- Other processes continue (configurable)
- Error shown when exiting

## No Adapter Provided

If `tabs` is not in router config:

```typescript
await r.tabs([...]);
// Error: Tabs adapter not available. Please provide a TabsAdapter...
```

## TabSpec Details

```typescript
type TabSpec = {
  label: string; // Display name in tab bar
  exec: string; // Shell command to run
};
```

The runner converts `r.exec()` and `r.run()` to TabSpecs:

```typescript
// r.exec('npm run dev') becomes:
{ label: 'npm', exec: 'npm run dev' }

// r.run(task) with env becomes (after resolution):
{ label: 'dev', exec: 'vite --mode dev' }
```

## Environment Resolution

Task environments are resolved before tabs render:

```typescript
await r.tabs([
  r.run(taskWithEnv), // Env resolved with loading spinner
  r.exec('other'),
]);
```

This shows a "Loading Secrets" group before the tabbed UI.

## Custom Adapter

Implement your own adapter:

```typescript
import type { TabsAdapter, TabSpec, TabsOptions } from '@pokjs/core';

const myAdapter: TabsAdapter = {
  async run(items: TabSpec[], options: TabsOptions) {
    // Spawn processes
    // Render UI
    // Handle input
    // Wait for completion
  },
};
```

## Related

- [Runner](./runner.md) - Using `r.tabs()`
- [defineTask](./define-task.md) - Tasks with shortLabel
- [@pokjs/tabs-ink](../packages/tabs-ink.md) - Ink implementation
- [@pokjs/tabs-core](../packages/tabs-core.md) - Shared logic
