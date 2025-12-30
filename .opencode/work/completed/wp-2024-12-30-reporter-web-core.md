# Reporter Web Core

## Problem
The playground needs a foundation package that transforms pok events into observable React state. Currently, event handling is terminal-centric. We need a `@pok/reporter-web` package that converts CLIEvents into a normalized state shape that React components can subscribe to, enabling the headless architecture where the same events can render as terminal output or React components.

## Scope
- `packages/reporter-web/` (new package)
- `packages/reporter-web/src/store.ts` - createReporterStore()
- `packages/reporter-web/src/types.ts` - State shape definitions
- `packages/reporter-web/src/hooks.ts` - useReporterStore, useActivity, useGroup
- `packages/reporter-web/package.json`
- `packages/reporter-web/tsconfig.json`

## Approach
1. Create new package structure with package.json, tsconfig.json
2. Define TypeScript types for ReporterState with:
   - Root lifecycle status (idle/running/complete/error)
   - Groups map (commands, parallel sections) with temporal markers
   - Activities map (tasks, steps) with status and progress
   - Logs array with level, message, timestamp
3. Implement `createReporterStore()` using external store pattern:
   - `getState()` returns current snapshot
   - `subscribe()` for React integration
   - `getSnapshot()` for useSyncExternalStore
   - Event handler that processes all CLIEvent types
4. Implement temporal markers (justStarted, justEnded, justCompleted) that auto-clear after 600ms
5. Create React hooks:
   - `useReporterStore()` - subscribe to entire state
   - `useActivity(id)` - subscribe to single activity
   - `useGroup(id)` - subscribe to single group
6. Write unit tests for all event types
7. Export package correctly for ESM consumption

## Hypothesis
Using `useSyncExternalStore` will provide seamless React 18+ integration while keeping the store framework-agnostic. The flat map structure for groups/activities will make lookups O(1) and subscriptions efficient. Temporal markers will enable smooth animations without complex state management.

## Acceptance Criteria
- [x] `createReporterStore()` returns store with `getState()`, `subscribe()`, `getSnapshot()`
- [x] Store correctly processes all CLIEvent types from `@openpok/core`
- [x] React hooks work with `useSyncExternalStore`
- [x] Temporal markers auto-clear after 600ms
- [x] Unit tests for all event types
- [x] Package builds and exports correctly

## Dependencies
None (foundation phase)

## Results

### Implemented Files

**Package Configuration:**
- `packages/reporter-web/package.json` - ESM package with React 18/19 peer dependency
- `packages/reporter-web/tsconfig.json` - TypeScript config with JSX support

**Source Files:**
- `packages/reporter-web/src/types.ts` - Complete type definitions:
  - `RootStatus`, `ActivityStatus` - Status enums
  - `TemporalMarkers` - Animation hints (justStarted, justCompleted, justFailed, justEnded)
  - `ActivityState`, `GroupState`, `LogEntry`, `RootState` - State shapes
  - `ReporterState` - Complete state with Maps for O(1) lookups
  - `ReporterStore` - Store interface compatible with useSyncExternalStore

- `packages/reporter-web/src/store.ts` - Store implementation:
  - `createReporterStore(options?)` - Creates external store
  - Handles all CLIEvent types (root:*, group:*, activity:*, log, reporter:*)
  - Temporal markers auto-clear after configurable delay (default 600ms)
  - Option to disable marker clearing for testing
  - Immutable state updates for React compatibility

- `packages/reporter-web/src/hooks.ts` - React hooks:
  - `useReporterState(store)` - Full state subscription
  - `useActivity(store, id)` - Single activity subscription with memoization
  - `useGroup(store, id)` - Single group subscription with memoization
  - `useRootState(store)` - Root state only
  - `useLogs(store)` - Logs array
  - `useSuspended(store)` - Suspended state

- `packages/reporter-web/src/adapter.ts` - ReporterAdapter implementation:
  - `createWebReporterAdapter(store)` - Pipes EventBus events to store
  - Implements `ReporterAdapter` interface from @openpok/core
  - Idempotent `stop()` method per adapter contract

- `packages/reporter-web/src/index.ts` - Public exports

**Test Files:**
- `packages/reporter-web/test/store.test.ts` - 31 tests covering:
  - Initial state
  - All event types (root:*, group:*, activity:*, log, reporter:*)
  - Subscription/unsubscription
  - Temporal marker clearing with delays

- `packages/reporter-web/test/adapter.test.ts` - 6 tests covering:
  - Event bus integration
  - Stop behavior (idempotent)
  - Full event workflows

### Test Results
- 37 tests passing
- 100 expect() calls
- All acceptance criteria met

## Evaluation

The implementation successfully provides a foundation for React-based rendering of pok events. Key design decisions:

1. **Maps for O(1) lookups** - Groups and activities stored in Maps rather than arrays for efficient access
2. **Immutable updates** - State is replaced entirely on each event, enabling React's referential equality checks
3. **Selective hooks with memoization** - `useActivity` and `useGroup` use refs to avoid unnecessary re-renders
4. **Configurable temporal markers** - Delay can be customized and disabled for testing
5. **Clean adapter interface** - Follows existing ReporterAdapter contract from @openpok/core
