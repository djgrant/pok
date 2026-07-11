# Events & Reporter

pok uses an event-driven architecture for all output. Commands emit semantic events that adapters render.

## Event pipeline

```
Command → Events → EventBus → ReporterAdapter → Terminal
```

## Imports

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
  | {
      type: 'activity:failure';
      id: ActivityId;
      error: Error | string;
      /** Remediation steps when the failure has fix instructions. */
      remediation?: string[];
      /** Documentation URL for more information about the failure. */
      documentationUrl?: string;
    }
  | { type: 'activity:update'; id: ActivityId; payload: ActivityUpdatePayload }

  // Logging
  | { type: 'log'; activityId?: ActivityId; level: LogLevel; message: string }

  // Markdown — raw markdown rendered by the adapter for its medium
  | { type: 'markdown'; activityId?: ActivityId; content: string };

type GroupLayout = 'sequence' | 'parallel';
type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'step';
```

Failures carrying `remediation` / `documentationUrl` (for example, from a
`CheckError`) let adapters render clean, actionable errors without dumping a
stack trace.

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

The Reporter provides a high-level API for emitting events. It is **scoped**: an
instance is always tied to a root, group, or activity context, and its methods
emit events for that scope.

### Reporter (full API)

```typescript
type Reporter = {
  // Logging
  info(message: string): void;
  warn(message: string): void;
  error(message: string | Error): void;
  success(message: string): void;
  step(message: string): void;

  // Markdown (rendered by the adapter for its medium; raw passthrough off-TTY)
  markdown(content: string): void;

  // Activity updates (progress / status for the current activity scope)
  update(payload: UpdatePayload): void;

  // Nesting
  activity<T>(label: string, fn: (reporter: Reporter) => Promise<T> | T): Promise<T>;
  activityWithMeta<T>(
    label: string,
    meta: Record<string, unknown>,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T>;
  group<T>(
    label: string,
    options: GroupOptions,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T>;
};

type UpdatePayload = string | { progress?: number; message?: string; [key: string]: unknown };
type GroupOptions = { layout: GroupLayout };
```

### Scoped variants

The runner and tasks receive restricted views of the reporter:

```typescript
// Available on the command runner (r.reporter) — logging and step sectioning.
type CommandReporter = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string | Error): void;
  success(message: string): void;
  step(message: string): void;
  markdown(content: string): void;
};

// Available inside a task — logging plus activity updates.
type TaskReporter = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string | Error): void;
  success(message: string): void;
  markdown(content: string): void;
  update(payload: UpdatePayload): void;
};
```

The full `Reporter` (with `group`/`activity`) is the callback argument passed to
`r.group(...)`.

### Usage in Commands

```typescript
run: async (r) => {
  // Simple logging on the command reporter
  r.reporter.info('Starting process...');
  r.reporter.warn('This may take a while');

  // Grouped activities — group() lives on the runner and yields a full Reporter
  await r.group('Build', { layout: 'sequence' }, async (g) => {
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

The default reporter adapter ships in [@pokit/terminal](../packages/terminal.md)
and is wired in automatically by the launcher. To get one directly:

```typescript
import { createTerminalUI } from '@pokit/terminal';

const { reporter } = createTerminalUI();
// reporter is a ReporterAdapter — pass it as `reporter` in pok.config.ts
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

// Capture events via the onEvent callback...
const events: CLIEvent[] = [];
const reporterAdapter = createRawReporterAdapter({ onEvent: (e) => events.push(e) });

await run(args, {
  reporterAdapter,
  // ...
});

expect(events).toContainEqual({
  type: 'log',
  activityId: undefined,
  level: 'success',
  message: 'Build complete!',
});
```

`start(bus)` also returns a controller exposing `getEvents()` if you prefer to
pull the captured events instead of pushing them.

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
