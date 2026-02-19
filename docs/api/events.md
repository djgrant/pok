# Events & Reporter

pok uses an event-driven architecture for all output. Commands emit semantic events that adapters render.

## Overview

```
Command → Events → EventBus → ReporterAdapter → Terminal
```

## Import

```typescript
import {
  // Event Bus
  createEventBus,

  // Reporter
  ScopedReporter,
  createRootReporter,

  // Type Guards
  isRootEvent,
  isGroupEvent,
  isActivityEvent,
  isLogEvent,

  // Types
  type CLIEvent,
  type EventBus,
  type Reporter,
  type ReporterAdapter,
} from '@pokit/core';
```

## CLIEvent Types

```typescript
type CLIEvent =
  // Lifecycle
  | { type: 'root:start'; appName: string; version?: string }
  | { type: 'root:end'; exitCode: number }

  // Grouping
  | { type: 'group:start'; id: GroupId; parentId?: GroupId; label: string; layout: GroupLayout }
  | { type: 'group:end'; id: GroupId }

  // Activities
  | {
      type: 'activity:start';
      id: ActivityId;
      parentId?: GroupId | ActivityId;
      label: string;
      meta?: Record<string, unknown>;
    }
  | { type: 'activity:success'; id: ActivityId; result?: unknown }
  | { type: 'activity:failure'; id: ActivityId; error: Error | string }
  | { type: 'activity:update'; id: ActivityId; payload: ActivityUpdatePayload }

  // Logging
  | { type: 'log'; activityId?: ActivityId; level: LogLevel; message: string }

  // TUI Control
  | { type: 'reporter:suspend' }
  | { type: 'reporter:resume' };

type GroupLayout = 'sequence' | 'parallel' | 'tabs' | 'grid';
type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'step';
```

## EventBus

The event bus is a pub/sub system for CLI events.

Note: `subscribe(listener)` is supported as a deprecated alias of `on(listener)` for compatibility.

```typescript
interface EventBus {
  emit(event: CLIEvent): void;
  on(listener: EventListener): Unsubscribe;
}

type EventListener = (event: CLIEvent) => void;
type Unsubscribe = () => void;
```

### Usage

```typescript
const eventBus = createEventBus();

// Subscribe to events
const unsubscribe = eventBus.on((event) => {
  console.log('Event:', event);
});

// Emit events
eventBus.emit({ type: 'log', level: 'info', message: 'Hello' });

// Unsubscribe
unsubscribe();
```

## Reporter

The Reporter provides a high-level API for emitting events.

### Reporter Interface

```typescript
interface Reporter {
  // Logging
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  step(message: string): void;

  // Grouping
  group<T>(
    label: string,
    options: GroupOptions,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T>;

  // Activities
  activity<T>(label: string, fn: () => Promise<T> | T): Promise<T>;
}
```

### CommandReporter

Extended reporter available in commands:

```typescript
interface CommandReporter extends Reporter {
  suspend(): void; // Suspend output for TUI takeover
  resume(): void; // Resume output
}
```

### Usage in Commands

```typescript
run: async (r) => {
  // Simple logging
  r.reporter.info('Starting process...');
  r.reporter.warn('This may take a while');

  // Grouped activities
  await r.reporter.group('Build', { layout: 'sequence' }, async (g) => {
    await g.activity('Compile', async () => {
      await r.exec('tsc');
    });

    await g.activity('Bundle', async () => {
      await r.exec('esbuild');
    });
  });

  r.reporter.success('Build complete!');
};
```

## ReporterAdapter

Adapters subscribe to events and render them to the terminal.

### Interface

```typescript
interface ReporterAdapter {
  start(eventBus: EventBus): ReporterAdapterController;
}

interface ReporterAdapterController {
  stop(): void;
}
```

### Using an Adapter

```typescript
import { run } from '@pokit/core';
import { createReporterAdapter } from '@pokit/reporter-clack';

await run(args, {
  // ...
  reporterAdapter: createReporterAdapter(),
});
```

## Activity Updates

Activities can report progress and status:

```typescript
type ActivityUpdatePayload = {
  progress?: number; // 0-100
  message?: string; // "Processing file 3/10"
  [key: string]: unknown; // Custom data
};

// In a task
run: async (r, ctx) => {
  // The task reporter supports updates
  ctx.reporter.update({ progress: 50, message: 'Halfway done' });
};
```

## Type Guards

```typescript
import { isRootEvent, isGroupEvent, isActivityEvent, isLogEvent } from '@pokit/core';

eventBus.on((event) => {
  if (isLogEvent(event)) {
    console.log(`[${event.level}] ${event.message}`);
  }

  if (isActivityEvent(event)) {
    if (event.type === 'activity:success') {
      console.log(`Activity ${event.id} completed`);
    }
  }
});
```

## Raw Reporter Adapter

For testing, use the raw adapter that collects events:

```typescript
import { createRawReporterAdapter } from '@pokit/core';

const { adapter, getEvents } = createRawReporterAdapter();

// Use adapter in tests
await run(args, {
  reporterAdapter: adapter,
  // ...
});

// Assert on collected events
const events = getEvents();
expect(events).toContainEqual({
  type: 'log',
  level: 'success',
  message: 'Build complete!',
});
```

## Event Flow Example

```
Command starts
  → group:start { id: 'g1', label: 'Build', layout: 'sequence' }
    → activity:start { id: 'a1', parentId: 'g1', label: 'Compile' }
    → activity:update { id: 'a1', payload: { progress: 50 } }
    → activity:success { id: 'a1' }
    → activity:start { id: 'a2', parentId: 'g1', label: 'Bundle' }
    → activity:success { id: 'a2' }
  → group:end { id: 'g1' }
  → log { level: 'success', message: 'Build complete!' }
```

## Suspend/Resume

For full-screen TUI takeover (like `r.tabs()`):

```typescript
// Reporter output is suspended
r.reporter.suspend();

// Full-screen TUI runs
await tabsAdapter.run([...]);

// Reporter output resumes
r.reporter.resume();
```

The adapter handles these events to pause/resume rendering.

## Related

- [Runner](./runner.md) - Using the reporter
- [Architecture](../architecture.md) - Event system overview
- [@pokit/reporter-clack](../packages/reporter-clack.md) - Clack adapter
