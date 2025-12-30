# Playground V4 Implementation Plan

## Executive Summary

Transform the pok playground from a terminal-centric learning tool into a 3-pane interactive tutorial that demonstrates pok's headless architecture. The key insight: **the same command events that render in a terminal can render as React components**.

---

## Decision Log

### D1: One Package, Not Two
**Decision**: Create a single `@pok/reporter-web` package with tutorial extensions, not two separate packages.

**Rationale**:
- The architecture recommendations suggested `@pok/reporter-web` + `@pok/tutorial-web`
- However, the tutorial-specific components (file previews, command runners) are just specialized renderers for specific event patterns
- Keeping them in one package reduces complexity and avoids cross-package coordination
- The tutorial components can be optional exports: `@pok/reporter-web/tutorial`
- If we later need to split, it's easier to extract than to merge

### D2: External Store with useSyncExternalStore
**Decision**: Use the external store pattern with `useSyncExternalStore` for React bindings.

**Rationale**:
- Matches architecture recommendation
- Works seamlessly with React 18+ concurrent features
- Enables non-React consumers (vanilla JS, other frameworks)
- Store shape: flat maps for groups/activities with temporal markers

### D3: Incremental Migration Strategy
**Decision**: Build the new tutorial panel alongside the existing terminal, then switch.

**Rationale**:
- The playground currently works - we shouldn't break it
- We can develop and test the tutorial panel in isolation
- Final switch is a layout change, not a rewrite
- Risk mitigation: if V4 fails, V3 still works

### D4: MVP Scope
**Decision**: Defer responsive breakpoints and advanced animations to post-MVP.

**MVP includes**:
- 3-pane layout (Explorer | Tutorial | Editor)
- Event-driven tutorial rendering
- File preview with "Create" action
- Command blocks with "Run" action
- Basic auto-progression (checkmark + scroll)

**Deferred**:
- Tablet 2-pane / mobile tabs layout
- Typewriter animation effect
- Progressive error handling tiers
- Copy button on command blocks

### D5: Tutorial Panel Width
**Decision**: Tutorial panel at 380px (not 320px as suggested).

**Rationale**:
- 320px is too narrow for code blocks with line numbers
- 380px provides comfortable reading width
- Editor panel gets remaining space (flexible)

---

## Phase 1: Reporter Web Core
**Goal**: Create the foundation package that transforms pok events into observable state.

**Scope**:
- `packages/reporter-web/` (new package)
- `packages/reporter-web/src/store.ts` - createReporterStore()
- `packages/reporter-web/src/types.ts` - State shape definitions
- `packages/reporter-web/src/hooks.ts` - useReporterStore, useActivity, useGroup
- `packages/reporter-web/package.json`

**State Shape**:
```typescript
type ReporterState = {
  // Root lifecycle
  status: 'idle' | 'running' | 'complete' | 'error';
  exitCode?: number;
  
  // Groups (commands, parallel sections)
  groups: Map<GroupId, {
    id: GroupId;
    parentId?: GroupId;
    label: string;
    layout: GroupLayout;
    status: 'running' | 'complete' | 'failed';
    justStarted: boolean;  // Temporal marker for animations
    justEnded: boolean;
  }>;
  
  // Activities (tasks, steps)
  activities: Map<ActivityId, {
    id: ActivityId;
    parentId?: GroupId | ActivityId;
    label: string;
    status: 'pending' | 'running' | 'success' | 'failure';
    progress?: number;
    message?: string;
    error?: string;
    justStarted: boolean;
    justCompleted: boolean;
  }>;
  
  // Logs
  logs: Array<{
    id: string;
    activityId?: ActivityId;
    level: LogLevel;
    message: string;
    timestamp: number;
  }>;
};
```

**Acceptance Criteria**:
- [ ] `createReporterStore()` returns store with `getState()`, `subscribe()`, `getSnapshot()`
- [ ] Store correctly processes all CLIEvent types from `@openpok/core`
- [ ] React hooks work with `useSyncExternalStore`
- [ ] Temporal markers auto-clear after 600ms
- [ ] Unit tests for all event types
- [ ] Package builds and exports correctly

**Dependencies**: None (foundation)

**Risk**: Low - well-understood pattern, no external dependencies

**Estimated Effort**: Small (1-2 days)

---

## Phase 2: Tutorial Renderer Components
**Goal**: Create headless React components for rendering tutorial content.

**Scope**:
- `packages/reporter-web/src/components/` (new directory)
- `packages/reporter-web/src/components/TutorialStep.tsx`
- `packages/reporter-web/src/components/FilePreview.tsx`
- `packages/reporter-web/src/components/CommandBlock.tsx`
- `packages/reporter-web/src/components/ProgressIndicator.tsx`
- `packages/reporter-web/src/components/ContentBox.tsx`

**Component Design** (headless with CSS variables):
```typescript
// FilePreview - renders file creation with preview
<FilePreview
  path="commands/hello.ts"
  content={code}
  status="pending" | "creating" | "created"
  onAction={() => createFile()}
  renderAction={({ onClick, status }) => <button onClick={onClick}>Create</button>}
/>

// CommandBlock - renders runnable command
<CommandBlock
  command="pok hello"
  status="idle" | "running" | "complete" | "failed"
  output={lines}
  onRun={() => runCommand()}
  renderAction={({ onClick, status }) => <button onClick={onClick}>Run</button>}
/>

// TutorialStep - wrapper for step content
<TutorialStep
  number={1}
  title="Create your first command"
  status="active" | "complete" | "pending"
  children={content}
/>
```

**CSS Variables for Styling**:
```css
--tutorial-bg: var(--bg-secondary);
--tutorial-step-active: var(--accent);
--tutorial-step-complete: var(--success);
--tutorial-code-bg: var(--bg-primary);
--tutorial-action-bg: var(--accent);
```

**Acceptance Criteria**:
- [ ] Components render correctly with data attributes for styling
- [ ] Render props pattern allows custom action buttons
- [ ] Components are unstyled (CSS variables only)
- [ ] Storybook or test page for visual verification
- [ ] TypeScript types are clean and exported

**Dependencies**: Phase 1 (store)

**Risk**: Medium - design decisions may need iteration

**Estimated Effort**: Medium (2-3 days)

---

## Phase 3: Tutorial Data Model
**Goal**: Create the structured tutorial content that drives the UI.

**Scope**:
- `playground/src/tutorial/` (new directory)
- `playground/src/tutorial/types.ts` - Tutorial step definitions
- `playground/src/tutorial/content.ts` - Actual tutorial content
- `playground/src/tutorial/engine.ts` - Tutorial progression logic

**Tutorial Structure**:
```typescript
type TutorialStep = 
  | { type: 'info'; title: string; content: string }
  | { type: 'file-create'; path: string; content: string; description: string }
  | { type: 'command-run'; command: string; description: string }
  | { type: 'tip'; content: string }
  | { type: 'choice'; options: Array<{ value: string; label: string }> };

type TutorialSection = {
  id: string;
  title: string;
  steps: TutorialStep[];
};

type Tutorial = {
  id: string;
  sections: TutorialSection[];
};
```

**Tutorial Engine**:
```typescript
type TutorialEngine = {
  // State
  currentSection: number;
  currentStep: number;
  completedSteps: Set<string>;
  
  // Actions
  completeStep(stepId: string): void;
  nextStep(): void;
  goToSection(sectionId: string): void;
  
  // Derived
  canProgress: boolean;
  progress: { completed: number; total: number };
};
```

**Acceptance Criteria**:
- [ ] Tutorial content migrated from learn.ts ANSI output to structured data
- [ ] Engine tracks progress and handles auto-progression
- [ ] 600ms pause before auto-scrolling to next step
- [ ] Content is separate from rendering (data-driven)
- [ ] Types are clean and well-documented

**Dependencies**: None (parallel with Phase 2)

**Risk**: Low - mostly data transformation

**Estimated Effort**: Small (1 day)

---

## Phase 4: Tutorial Panel UI
**Goal**: Create the tutorial panel component that renders in the playground.

**Scope**:
- `playground/src/components/TutorialPanel.tsx` (new)
- `playground/src/components/TutorialPanel.css` (new)
- `playground/src/hooks/useTutorialEngine.ts` (new)

**Layout**:
```
+---------------------------+
|  pok learn               |  <- Header with section title
+---------------------------+
|                          |
|  Step 1 of 5             |  <- Progress indicator
|  Create your first cmd   |
|                          |
|  [Info Box]              |  <- Current step content
|                          |
|  ┌─ commands/hello.ts ──┐|  <- File preview
|  │ const { define... }  │|
|  │ ...                  │|
|  └──────────────────────┘|
|                          |
|  [ Create File ]         |  <- Action button
|                          |
|  ✓ Step 1 complete       |  <- Completed indicator
|                          |
|  Step 2 of 5             |  <- Next step (scrolled into view)
|  ...                     |
+---------------------------+
```

**Styling**:
- Background: slightly brighter than terminal (`--bg-secondary` + 5%)
- Width: 380px fixed
- Scrollable content area
- Sticky header with progress

**Acceptance Criteria**:
- [ ] Panel renders tutorial content from engine
- [ ] File preview shows code with syntax highlighting
- [ ] "Create File" button triggers WebContainer file write
- [ ] Command blocks show "Run" button
- [ ] Completed steps show checkmark and fade slightly
- [ ] Auto-scroll to next step after completion
- [ ] Panel scrolls smoothly

**Dependencies**: Phase 2 (components), Phase 3 (content)

**Risk**: Medium - integration with WebContainer actions

**Estimated Effort**: Medium (2-3 days)

---

## Phase 5: Three-Pane Layout
**Goal**: Transform the playground layout to Explorer | Tutorial | Editor.

**Scope**:
- `playground/src/App.tsx` - Layout restructure
- `playground/src/index.css` - Layout CSS updates
- `playground/src/components/Sidebar.tsx` - Simplify to explorer only
- `playground/src/hooks/useWorkspace.ts` - Update tab model

**New Layout**:
```
+--------+-------------------+------------------+
| EXPLR  |     TUTORIAL      |     EDITOR       |
|        |                   |                  |
| > src/ |  [Tutorial Panel] | +-- hello.ts --+ |
|        |                   | | code...      | |
|        |                   | +--------------+ |
|        |                   |                  |
|        |                   | +-- Terminal --+ |
|        |                   | | $ pok hello  | |
|        |                   | | > Hello!     | |
|        |                   | +--------------+ |
+--------+-------------------+------------------+
```

**Key Changes**:
1. Remove tab-bar from sidebar (Explorer is just files now)
2. Add TutorialPanel as fixed center column
3. Editor area becomes tabbed (files + terminal)
4. Terminal remains for "Run" command output
5. Editor shows file when clicked in explorer or tutorial

**CSS Grid Layout**:
```css
.app-body {
  display: grid;
  grid-template-columns: var(--sidebar-width) 380px 1fr;
  grid-template-rows: 1fr;
}
```

**Acceptance Criteria**:
- [ ] Three-column layout renders correctly
- [ ] Explorer shows file tree only
- [ ] Tutorial panel is center column
- [ ] Editor area has tabs (terminal + files)
- [ ] Clicking file in explorer opens in editor
- [ ] Clicking file in tutorial opens in editor
- [ ] Running command shows output in terminal
- [ ] Layout is stable (no jank on interactions)

**Dependencies**: Phase 4 (tutorial panel)

**Risk**: High - significant layout change, many integration points

**Estimated Effort**: Medium (2-3 days)

---

## Phase 6: WebContainer Integration
**Goal**: Connect tutorial actions to WebContainer for real file/command execution.

**Scope**:
- `playground/src/hooks/useTutorialActions.ts` (new)
- `playground/src/hooks/useWebContainer.ts` (updates)
- Integration between TutorialPanel and WebContainer

**Actions**:
```typescript
type TutorialActions = {
  createFile(path: string, content: string): Promise<void>;
  runCommand(command: string): Promise<{ exitCode: number; output: string[] }>;
  openFile(path: string): void;
};
```

**Flow**:
1. User clicks "Create File" in tutorial
2. `createFile()` writes to WebContainer
3. File tree updates (via existing event bus)
4. File opens in editor tab
5. Explorer highlights new file briefly

**Command Execution**:
1. User clicks "Run" on command block
2. Terminal tab becomes active
3. Command runs in terminal
4. Output captured and shown in command block too
5. Exit code determines success/failure styling

**Acceptance Criteria**:
- [ ] File creation works and updates explorer
- [ ] Command execution works and shows in terminal
- [ ] Errors are handled gracefully (show in tutorial)
- [ ] Actions are debounced (prevent double-clicks)
- [ ] Loading states shown during async operations

**Dependencies**: Phase 5 (layout)

**Risk**: Medium - WebContainer async behavior can be tricky

**Estimated Effort**: Medium (2 days)

---

## Phase 7: Polish & Animation
**Goal**: Add the finishing touches that make the experience delightful.

**Scope**:
- Animation for step completion (checkmark + fade)
- Smooth scroll to next step
- File highlight animation in explorer
- Loading spinners for async actions
- Error states with helpful messages

**Animations**:
```css
/* Step completion */
.tutorial-step-complete {
  animation: stepComplete 300ms ease-out;
}

@keyframes stepComplete {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); opacity: 0.7; }
}

/* Explorer file highlight */
.file-tree-item-highlight {
  animation: fileHighlight 1s ease-out;
}

@keyframes fileHighlight {
  0% { background: var(--success-muted); }
  100% { background: transparent; }
}
```

**Acceptance Criteria**:
- [ ] Step completion feels satisfying
- [ ] Auto-scroll is smooth (not jarring)
- [ ] New files are visually highlighted
- [ ] Loading states prevent user confusion
- [ ] Error states are clear and actionable

**Dependencies**: Phase 6 (integration complete)

**Risk**: Low - cosmetic, can ship without

**Estimated Effort**: Small (1 day)

---

## Deferred Items

### Responsive Layout (Post-MVP)
- Tablet: 2-pane (hide explorer, collapsible)
- Mobile: Tab-based (Explorer | Tutorial | Editor as tabs)
- Breakpoints: 1024px (tablet), 768px (mobile)

### Advanced Command Block Features (Post-MVP)
- Copy button to clipboard
- Typewriter effect for command text
- Syntax highlighting in output

### Progressive Error Handling (Post-MVP)
- Minor errors: Accept and continue
- Moderate errors: Warning with "Continue anyway"
- Major errors: Block progression with fix instructions

### Tutorial Persistence (Post-MVP)
- Save progress to localStorage
- Resume from last step on reload
- Reset button to start over

### Analytics (Post-MVP)
- Track step completion rates
- Identify where users get stuck
- Measure time-to-completion

---

## Risks & Mitigations

### R1: WebContainer Reliability
**Risk**: WebContainer may have timing issues or fail in certain browsers.
**Mitigation**: 
- Existing playground already handles this
- Add retry logic for transient failures
- Show clear error messages with "Retry" option

### R2: Layout Complexity
**Risk**: Three-pane layout may be difficult to get right.
**Mitigation**:
- Use CSS Grid for reliable layout
- Test at multiple viewport sizes
- Have fallback to simpler layout if needed

### R3: Tutorial Content Sync
**Risk**: Tutorial content may get out of sync with actual pok behavior.
**Mitigation**:
- Tutorial steps execute real commands
- Tests verify tutorial commands work
- Content is data-driven (easy to update)

### R4: Performance
**Risk**: Rendering tutorial + terminal + file viewer may be slow.
**Mitigation**:
- React 18 concurrent features
- Virtualize long lists if needed
- Profile and optimize hot paths

### R5: Scope Creep
**Risk**: Nice-to-have features delay MVP.
**Mitigation**:
- Clear MVP definition in Decision D4
- Deferred items list is explicit
- Ship incrementally

---

## Implementation Order Summary

```
Week 1:
├── Phase 1: Reporter Web Core (1-2 days)
├── Phase 2: Tutorial Renderer Components (2-3 days) 
└── Phase 3: Tutorial Data Model (1 day, parallel)

Week 2:
├── Phase 4: Tutorial Panel UI (2-3 days)
└── Phase 5: Three-Pane Layout (2-3 days)

Week 3:
├── Phase 6: WebContainer Integration (2 days)
└── Phase 7: Polish & Animation (1 day)
```

**Total Estimated Effort**: ~2-3 weeks

---

## Success Metrics

1. **Functional**: Tutorial completes end-to-end (all steps work)
2. **Performance**: No jank during normal usage
3. **Usability**: User can complete tutorial without confusion
4. **Maintainability**: Tutorial content is data-driven, easy to update
5. **Extensibility**: Reporter-web package is reusable outside playground
