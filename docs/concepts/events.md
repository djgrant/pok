# Event System Deep Dive

pok's event-driven architecture decouples command logic from terminal output.

## Why Events?

1. **Testability** - Assert on events, not terminal output
2. **Flexibility** - Different UIs for different contexts
3. **Separation** - Commands focus on logic, adapters on presentation
4. **Composability** - Multiple adapters can consume events

## Event Flow

```
Command Logic → Reporter → EventBus → Adapter → Terminal
```

```typescript
// Command emits semantic events
r.reporter.info('Starting build...');

// Event bus receives
{ type: 'log', level: 'info', message: 'Starting build...' }

// Adapter renders
console.log('ℹ Starting build...');
```

## Event Types

### Lifecycle Events

```typescript
// Application start
{ type: 'root:start', appName: 'mycli', version: '1.0.0' }

// Application end
{ type: 'root:end', exitCode: 0 }
```

### Group Events

Groups organize related activities:

```typescript
// Group start
{
  type: 'group:start',
  id: 'g1',
  parentId: undefined,
  label: 'Build',
  layout: 'sequence'  // or 'parallel', 'tabs', 'grid'
}

// Group end
{ type: 'group:end', id: 'g1' }
```

### Activity Events

Activities are units of work:

```typescript
// Activity start
{
  type: 'activity:start',
  id: 'a1',
  parentId: 'g1',
  label: 'Compile TypeScript',
  meta: { files: 42 }
}

// Activity update (progress)
{
  type: 'activity:update',
  id: 'a1',
  payload: { progress: 50, message: '21 of 42 files' }
}

// Activity success
{ type: 'activity:success', id: 'a1', result: undefined }

// Activity failure
{ type: 'activity:failure', id: 'a1', error: Error('Compilation failed') }
```

### Log Events

```typescript
{
  type: 'log',
  activityId: 'a1',  // Optional: associate with activity
  level: 'info',     // 'info' | 'warn' | 'error' | 'success' | 'step'
  message: 'Processing...'
}
```

### Reporter Control Events

```typescript
// Suspend output (for fullscreen TUI)
{
  type: 'reporter:suspend';
}

// Resume output
{
  type: 'reporter:resume';
}
```

## Using the Reporter

### In Commands

```typescript
run: async (r) => {
  // Simple logging
  r.reporter.info('Starting...');
  r.reporter.warn('This may take a while');
  r.reporter.success('Done!');
  r.reporter.error('Something failed');
  r.reporter.step('Step 1 of 3');

  // Grouped activities
  await r.reporter.group('Build', { layout: 'sequence' }, async (g) => {
    await g.activity('Compile', async () => {
      await r.exec('tsc');
    });

    await g.activity('Bundle', async () => {
      await r.exec('esbuild');
    });
  });
};
```

### In Tasks

```typescript
const myTask = defineTask({
  label: 'My Task',
  run: async (r, ctx) => {
    ctx.reporter.info('Task starting...');

    // Update progress
    for (let i = 0; i <= 100; i += 10) {
      await doWork();
      ctx.reporter.update({ progress: i });
    }

    ctx.reporter.success('Task complete');
  },
});
```

## Creating Adapters

### Basic Adapter

```typescript
import type { ReporterAdapter, EventBus, CLIEvent } from '@pokit/core';

const myAdapter: ReporterAdapter = {
  start(eventBus: EventBus) {
    const unsubscribe = eventBus.on((event: CLIEvent) => {
      renderEvent(event);
    });

    return {
      stop() {
        unsubscribe();
      },
    };
  },
};

function renderEvent(event: CLIEvent) {
  switch (event.type) {
    case 'log':
      const prefix = {
        info: 'ℹ',
        warn: '⚠',
        error: '✖',
        success: '✔',
        step: '→',
      }[event.level];
      console.log(`${prefix} ${event.message}`);
      break;

    case 'group:start':
      console.log(`\n◆ ${event.label}`);
      break;

    case 'activity:start':
      process.stdout.write(`  ◇ ${event.label}...`);
      break;

    case 'activity:success':
      console.log(' ✔');
      break;

    case 'activity:failure':
      console.log(' ✖');
      break;
  }
}
```

### Stateful Adapter

```typescript
const spinnerAdapter: ReporterAdapter = {
  start(eventBus) {
    const spinners = new Map<string, Spinner>();

    const unsubscribe = eventBus.on((event) => {
      switch (event.type) {
        case 'activity:start':
          const spinner = createSpinner(event.label);
          spinners.set(event.id, spinner);
          spinner.start();
          break;

        case 'activity:update':
          const s = spinners.get(event.id);
          if (s && event.payload.message) {
            s.message = event.payload.message;
          }
          break;

        case 'activity:success':
          spinners.get(event.id)?.success();
          spinners.delete(event.id);
          break;

        case 'activity:failure':
          spinners.get(event.id)?.fail();
          spinners.delete(event.id);
          break;
      }
    });

    return {
      stop() {
        for (const spinner of spinners.values()) {
          spinner.stop();
        }
        unsubscribe();
      },
    };
  },
};
```

## Testing with Events

### Raw Reporter Adapter

```typescript
import { createRawReporterAdapter } from '@pokit/core';

test('command emits correct events', async () => {
  const { adapter, getEvents } = createRawReporterAdapter();

  await run(['build'], {
    reporterAdapter: adapter,
    // ...
  });

  const events = getEvents();

  expect(events).toContainEqual({
    type: 'log',
    level: 'success',
    message: 'Build complete!',
  });

  expect(events.filter((e) => e.type === 'activity:success')).toHaveLength(3);
});
```

### Event Assertions

```typescript
const events = getEvents();

// Check sequence
const groupStart = events.find((e) => e.type === 'group:start');
const groupEnd = events.find((e) => e.type === 'group:end');
expect(events.indexOf(groupStart)).toBeLessThan(events.indexOf(groupEnd));

// Check all activities succeeded
const failures = events.filter((e) => e.type === 'activity:failure');
expect(failures).toHaveLength(0);
```

## Suspend/Resume

For fullscreen TUI takeover:

```typescript
run: async (r) => {
  r.reporter.info('Opening console...');

  // Suspend normal output
  r.reporter.suspend();

  // Fullscreen TUI runs
  await tabsAdapter.run([...]);

  // Resume normal output
  r.reporter.resume();

  r.reporter.success('Console closed');
}
```

The adapter handles these events:

```typescript
 eventBus.on((event) => {
  if (event.type === 'reporter:suspend') {
    // Stop rendering, clear screen
  }
  if (event.type === 'reporter:resume') {
    // Resume rendering
  }
});
```

## Layout Hints

Groups include layout hints for adapters:

```typescript
await r.group('Tasks', { layout: 'parallel' }, async (g) => {
  // ...
});
```

| Layout     | Meaning                          |
| ---------- | -------------------------------- |
| `sequence` | Activities run one after another |
| `parallel` | Activities run concurrently      |
| `tabs`     | Each activity is a tab           |
| `grid`     | Arrange in grid layout           |

Adapters can use or ignore these hints.

## Event IDs

IDs are generated for tracking:

```typescript
{
  type: 'group:start',
  id: 'g_abc123',       // Unique group ID
  parentId: undefined,   // Root group
  label: 'Build',
}

{
  type: 'activity:start',
  id: 'a_def456',       // Unique activity ID
  parentId: 'g_abc123', // Parent group
  label: 'Compile',
}
```

## Best Practices

### 1. Semantic Events

Emit meaningful events, not rendering instructions:

```typescript
// Good - semantic
r.reporter.info('Deploying to staging');

// Bad - rendering-specific
r.reporter.emit({ type: 'print', color: 'blue', text: '...' });
```

### 2. Use Groups for Structure

```typescript
await r.group('Deploy', { layout: 'sequence' }, async (g) => {
  await g.activity('Build', () => build());
  await g.activity('Push', () => push());
  await g.activity('Verify', () => verify());
});
```

### 3. Report Progress

```typescript
await g.activity('Processing', async () => {
  for (let i = 0; i < items.length; i++) {
    await process(items[i]);
    ctx.reporter.update({
      progress: Math.round((i / items.length) * 100),
      message: `${i + 1} of ${items.length}`,
    });
  }
});
```

### 4. Meaningful Error Events

```typescript
// Good - includes context
r.reporter.error(`Failed to connect to ${url}: ${error.message}`);

// Bad - vague
r.reporter.error('Error');
```

## Related

- [API Reference: Events](../api/events.md)
- [Architecture](../architecture.md)
- [@pokit/reporter-clack](../packages/reporter-clack.md)
