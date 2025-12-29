# Web Editor Adapter MVP Scoping

## Problem

The playground needs to demonstrate pok's power through pok itself - "showcase pok with pok." Currently, users interact with pok in a terminal but can't see or edit the command source code alongside execution. A web editor adapter would show command source files alongside terminal output, genuinely demonstrating pok's extensibility.

## Scope

New package: `packages/editor-web/` (or `packages/adapter-web-editor/`)

Touches:
- `packages/core/src/events/` - May need new event types
- `playground/` - Integration point

## Adapter Pattern Summary

pok adapters follow a simple pattern:

### 1. ReporterAdapter Interface
```typescript
interface ReporterAdapter {
  start(bus: EventBus): ReporterAdapterController;
}

interface ReporterAdapterController {
  stop(): void;
}
```

### 2. Event-Driven Architecture
- Adapters subscribe to an `EventBus` via `bus.on(handler)`
- They receive `CLIEvent` discriminated unions
- Events: `root:start/end`, `group:start/end`, `activity:start/update/success/failure`, `log`, `reporter:suspend/resume`
- Adapters maintain internal state and render based on events
- The `stop()` method unsubscribes and cleans up

### 3. State Reducer Pattern (tabs-core)
```typescript
function reducer(state: EventDrivenState, event: CLIEvent): EventDrivenState
```
Framework-agnostic state tree built from events. Used by both tabs-ink (React/Ink) and tabs-opentui.

### 4. Prompter Interface (different pattern)
```typescript
interface Prompter {
  select<T>(options: SelectOptions<T>): Promise<T>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  text(options: TextOptions): Promise<string>;
  // ...
}
```
Prompters are direct function calls, not event-driven.

## MVP Scope

### What MVP Does

1. **Show source code** - Display the current command's source file in a read-only editor pane
2. **Track execution** - Highlight the active command file as it runs
3. **Basic editing** - Allow edits that persist in WebContainer filesystem
4. **Re-run reflects changes** - When user runs command again, edited code executes

### What MVP Does NOT Do

- Live reload (no file watchers)
- Syntax highlighting (defer to monaco/codemirror later)
- Breakpoints or debugging
- Multiple file tabs
- File tree navigation
- Type checking or LSP
- Split terminal/editor view management (playground handles this)

### Minimum Events to Handle

```typescript
type EditorEvent =
  | { type: 'file:focus'; path: string }    // New: which file is active
  | { type: 'activity:start'; ... }          // Track which command is running
  | { type: 'activity:success' | 'activity:failure'; ... }
```

**Key insight**: The adapter needs to know *which file* corresponds to the running command. This requires either:
- A new event type (`file:focus`)
- Metadata on `activity:start` (e.g., `meta: { sourceFile: 'commands/hello.ts' }`)

Recommendation: Use `meta` field on `activity:start` - no new event types needed for MVP.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Playground (React)                                      │
│  ┌─────────────────────┐  ┌───────────────────────────┐ │
│  │  Terminal (xterm)   │  │  Editor Panel             │ │
│  │  ┌───────────────┐  │  │  ┌─────────────────────┐  │ │
│  │  │ pok running   │  │  │  │ commands/hello.ts   │  │ │
│  │  │ in WebContainer│  │  │  │ (editable textarea) │  │ │
│  │  └───────────────┘  │  │  └─────────────────────┘  │ │
│  └─────────────────────┘  └───────────────────────────┘ │
│                    ▲                 │                   │
│                    │                 │ save              │
│                    │ events          ▼                   │
│              ┌─────┴─────────────────────┐              │
│              │  EditorAdapter (bridge)    │              │
│              │  - listens to EventBus     │              │
│              │  - posts messages to React │              │
│              └────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Communication Options

**Option A: Message Passing (Recommended for MVP)**
- pok in WebContainer emits events to EventBus
- A bridge script posts events to parent window via `postMessage`
- React playground receives and updates editor state
- Edits are written back to WebContainer filesystem via existing APIs

```typescript
// In WebContainer (injected bridge)
bus.on((event) => {
  if (event.type === 'activity:start' && event.meta?.sourceFile) {
    window.parent.postMessage({ type: 'pok:file:active', path: event.meta.sourceFile }, '*');
  }
});
```

**Option B: Direct React Integration**
- Requires running React inside WebContainer
- More complex, not MVP-appropriate

### Package Structure

For MVP, this might not even need a package. It could be:
1. A bridge script injected into WebContainer
2. React components in playground that handle the messages

If packaged:
```
packages/editor-web/
  src/
    bridge.ts       # Script to run in WebContainer
    types.ts        # Message types
  package.json
```

### Integration with Playground

1. Mount a bridge script in WebContainer that hooks the EventBus
2. Add editor panel component to playground
3. Read file content from WebContainer when `file:active` received
4. Write edits back to WebContainer filesystem

## Open Questions

### 1. How does the adapter know which file is running?
**Options:**
- A. Router adds `sourceFile` to activity meta when running commands
- B. Editor adapter infers from command name → file path convention
- C. New event type for file focus

**Recommendation**: Option B for MVP (convention-based: `commands/${commandName}.ts`), with A as enhancement.

### 2. Where does the bridge script run?
**Options:**
- A. As part of pok config (user must opt-in)
- B. Playground injects it during WebContainer setup
- C. pok core detects browser environment and auto-enables

**Recommendation**: Option B for MVP - playground-specific concern.

### 3. Should edits trigger re-run?
**Options:**
- A. Manual re-run only (user must exit and run command again)
- B. Save triggers automatic re-run
- C. Live reload with file watcher

**Recommendation**: Option A for MVP. Keep it simple.

### 4. What editor component to use?
**Options:**
- A. Plain `<textarea>` with monospace font
- B. Monaco editor (VS Code's editor)
- C. CodeMirror

**Recommendation**: Option A for MVP. Add syntax highlighting later.

### 5. Layout: side-by-side or toggle?
**Options:**
- A. Fixed split (50/50 terminal/editor)
- B. Resizable split
- C. Toggle button to switch views
- D. Overlay/drawer

**Recommendation**: Option C (toggle) for MVP. Simpler, mobile-friendly.

## MVP Implementation Checklist

1. [ ] Add `sourceFile` derivation in playground (from command name)
2. [ ] Add editor panel component (toggle-able, uses textarea)
3. [ ] Read file content from WebContainer when command runs
4. [ ] Enable editing with save-to-filesystem
5. [ ] Add toggle button to switch between terminal-only and terminal+editor
6. [ ] Update SPEC.md with new behavior

## Success Criteria

- User runs `pok hello`
- Editor panel shows `commands/hello.ts` source
- User edits the file and saves
- User runs `pok hello` again - sees their changes take effect

## Hypothesis

A minimal "web editor adapter" doesn't need to be a full pok adapter at all for MVP. The convention `commands/${name}.ts` combined with WebContainer filesystem access is sufficient. The real adapter pattern would be valuable later for:
- Showing source for tasks (not just commands)
- Highlighting which line is executing
- Showing check definitions
- Debugging support

## Results

{To be filled upon implementation}

## Evaluation

{To be filled upon completion}
