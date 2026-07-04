# @pokit/reporter-web

Web/React event reporter for pok CLI applications. Implements the `ReporterAdapter` interface from `@pokit/core`, piping CLI events into a store you can subscribe to from React.

## Install

```bash
bun add @pokit/reporter-web
```

## Usage

```typescript
import { createReporterStore, createWebReporterAdapter } from '@pokit/reporter-web';
import { createEventBus } from '@pokit/core';

const store = createReporterStore();
const adapter = createWebReporterAdapter(store);
const bus = createEventBus();

const controller = adapter.start(bus);

// Events emitted to the bus will update the store
bus.emit({ type: 'root:start', appName: 'my-app' });

// In React:
// const state = useReporterState(store);

// Cleanup
controller.stop();
```

### React hooks

Subscribe to store state from React components with `useReporterState`, `useActivity`, `useGroup`, `useRootState`, `useLogs`, and `useSuspended`.

### Components

Ready-made presentational components are also exported: `TutorialStep`, `FilePreview`, `CommandBlock`, `ProgressIndicator`, and `ContentBox`.
