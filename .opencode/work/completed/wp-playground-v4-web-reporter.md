# Playground V4: Web Reporter & Interactive Tutorial

## Vision

pok is a **headless CLI framework** - not coupled to the terminal. The playground should demonstrate this by rendering the same `pok learn` command through two different adapters:

1. **Terminal** - Run `pok learn` in the shell tab, get classic ANSI output via `reporter-clack`
2. **Web** - A dedicated tutorial pane renders the same command as native React components via a new `@pok/reporter-web` package

This proves pok's core architectural claim: define once, render anywhere.

## Objectives

### 1. Create `@pok/reporter-web` Package

A reusable package that implements the `ReporterAdapter` interface for web/React contexts.

**Must support:**
- All existing event types: `group:start/end`, `activity:start/success/failure/update`, `log`, `reporter:suspend/resume`
- React component rendering for each event type
- Stateful accumulation of events into renderable UI
- File preview components (for "create file" actions)
- Action buttons that trigger commands (e.g., create file)

**Design principle:** Same command definition, different visual output.

### 2. Transform Playground Layout

Replace the current split-terminal layout with a fixed three-pane IDE-like structure:

```
┌─────────────┬──────────────────┬─────────────────────────────┐
│  EXPLORER   │    TUTORIAL      │          EDITOR             │
│             │                  │  ┌─────────────────────────┐ │
│  FILES      │  [Web-rendered   │  │ Tab: Shell │ Tab: File │ │
│  └─ pok.ts  │   pok learn]     │  ├─────────────────────────┤ │
│  └─ ...     │                  │  │                         │ │
│             │  Step 1 of N     │  │  $ pok hello            │ │
│             │                  │  │  Hello from pok!        │ │
│             │  [Create File]   │  │                         │ │
│             │                  │  │                         │ │
└─────────────┴──────────────────┴─────────────────────────────┘
```

**Key changes:**
- Remove split-pane terminal view
- Add fixed Tutorial pane (center)
- Editor pane contains tabbed shell + file viewer (right)
- All panes resizable
- Explorer remains on left

### 3. Redesign Tutorial for Interactivity

The current tutorial does everything for the user. The new tutorial should create learning moments by requiring user action.

**Philosophy shift:**
- Old: "Watch pok create a file and run a command"
- New: "Here's the code. Click to create the file. Now run `pok hello` in the shell."

**Interactive elements:**
- **File preview + create button**: Show code in a mini file viewer, button underneath creates the file
- **Command hints**: Tell user what to run, they type it themselves
- **Auto-progression**: Tutorial advances when user completes the task (file created, command executed)
- **Visual feedback**: Explorer highlights newly created files (transition animation)

**Content scope:** Rethink tutorial from scratch. Focus on 3-4 fully interactive lessons rather than 5 half-interactive ones.

## Open Questions

### Architecture

1. **Event rendering model**: Should the web reporter be:
   - **Streaming** - renders events as they arrive (like terminal scrolling)
   - **Declarative** - accumulates events into state, re-renders whole view
   - **Hybrid** - accumulates state with animations for new content

2. **Tutorial state bridge**: How does the web-rendered tutorial in the center pane communicate with WebContainer running in the editor pane?
   - Shared event bus?
   - Direct WebContainer API access from tutorial pane?
   - Message passing via parent component?

### Tutorial Progression

3. **What triggers auto-progression?**
   - File creation detected via WebContainer watcher
   - Command execution (any `pok *` command)
   - Command output matches expected pattern
   - Manual "Next" button as fallback
   - Some combination?

4. **How sophisticated should verification be?**
   - Simple: Just detect file exists or command ran
   - Verified: Check file content matches, command output correct
   - Relaxed: User clicks "I did it" after instructions

### UX

5. **Responsive behavior**: What happens on narrow screens?
   - Stack vertically?
   - Tab-based (one pane visible at a time)?
   - Progressive collapse (explorer hides first, then tutorial)?

6. **File creation UX**: The button that creates files - what should it show?
   - Simple: `[Create File]`
   - Command-like: `[ $ echo '...' > commands/hello.ts ] [Run]`
   - Just the action, implementation hidden

### Content

7. **Tutorial content scope**: What lessons should the interactive tutorial include?
   - Current: commands, flags, tabs, tasks, free explore
   - Keep all but make some "view only"?
   - Trim to fewer, fully interactive lessons?
   - Completely new structure?

## Technical Context

### Existing Reporter Architecture

pok already has a clean event-based system:

```typescript
// Core interface (packages/core/src/events/adapter.ts)
interface ReporterAdapter {
  start(bus: EventBus): ReporterAdapterController;
}

// Event types (packages/core/src/events/types.ts)
type CLIEvent = 
  | { type: 'group:start'; ... }
  | { type: 'activity:start'; ... }
  | { type: 'log'; level: 'info' | 'warn' | 'error' | 'success' | 'step'; ... }
  // ...etc
```

The `reporter-clack` package shows how to implement an adapter - subscribe to EventBus, render events as terminal output.

### Recommended Library

**react-resizable-panels** - Best fit for the three-pane layout:
- Collapsible panels with imperative API
- Built-in layout persistence
- Full accessibility (WAI-ARIA)
- Maintained by Brian Vaughn (React core team)
- ~8-10KB gzipped

## Success Criteria

1. **Dual rendering works**: Same `pok learn` command renders in terminal (shell tab) AND as React components (tutorial pane)
2. **Tutorial is interactive**: User must take action (create file, run command) to progress
3. **Auto-progression works**: Tutorial advances when tasks complete
4. **File creation has feedback**: Explorer highlights new files, tutorial shows confirmation
5. **Layout is resizable**: All three panes can be resized
6. **Package is reusable**: `@pok/reporter-web` can be used outside the playground

## Out of Scope

- Mobile-first design (responsive is nice-to-have)
- Clipboard integration
- Tutorial persistence/progress saving
- Multiple tutorial tracks

## Dependencies

- Understanding of pok's EventBus and ReporterAdapter interfaces
- WebContainer API for file watching and command execution
- React 18+ for the web reporter components

## References

- Previous work: `wp-2024-12-29-playground-v3-react-layout.md`
- Previous work: `wp-2024-12-30-playground-v3-polish.md`
- Core reporter: `packages/reporter-clack/src/adapter.ts`
- Event types: `packages/core/src/events/types.ts`

---

## Resolved Decisions

*Added after design and architecture review on 2024-12-30*

### Open Questions Resolved

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Event rendering model** | Declarative with animation markers | Flat maps with `justStarted`/`justCompleted` temporal flags that auto-clear after 600ms |
| **Tutorial state bridge** | Direct WebContainer access from tutorial | Tutorial actions call WebContainer API directly; events flow through existing event bus |
| **Auto-progression triggers** | File creation + command execution | Detect via WebContainer file watcher and command exit codes |
| **Verification sophistication** | Simple | Just detect file exists or command ran; no content validation in MVP |
| **Responsive behavior** | Deferred | Desktop-first; responsive breakpoints are post-MVP |
| **File creation UX** | File preview card with "Create →" button | Shows filename header, code preview, action button |
| **Tutorial content** | Restructured data-driven format | Tutorial steps as typed data, not ANSI strings |

### Key Architecture Decisions

1. **Single package**: `@pok/reporter-web` with tutorial extensions (not two packages)
2. **External store**: `createReporterStore()` + `useSyncExternalStore` for React bindings
3. **Headless components**: Render props pattern, CSS variables for styling
4. **Tutorial panel width**: 380px (not 320px) for code readability

### UX Decisions

1. **File creation**: File preview card with header + "Create →" button + explorer highlight animation
2. **Command execution**: Hybrid - Copy + Run buttons (typewriter effect deferred)
3. **Auto-progression**: Checkmark animation → 600ms pause → smooth scroll
4. **Error handling**: Progressive tiers deferred; MVP accepts and continues

## Implementation Plan

See detailed plan: `playground-v4-implementation-plan.md`

### Phase Summary

| Phase | Description | Effort | Risk |
|-------|-------------|--------|------|
| 1 | Reporter Web Core (store, hooks) | Small | Low |
| 2 | Tutorial Renderer Components | Medium | Medium |
| 3 | Tutorial Data Model | Small | Low |
| 4 | Tutorial Panel UI | Medium | Medium |
| 5 | Three-Pane Layout | Medium | **High** |
| 6 | WebContainer Integration | Medium | Medium |
| 7 | Polish & Animation | Small | Low |

**Total estimated effort**: 2-3 weeks

### MVP Scope

**Included:**
- 3-pane layout (Explorer | Tutorial | Editor)
- Event-driven tutorial rendering via `@pok/reporter-web`
- File preview with "Create" action
- Command blocks with "Run" action
- Basic auto-progression

**Deferred:**
- Responsive breakpoints
- Typewriter animation
- Copy button on commands
- Progressive error handling
- Tutorial persistence
