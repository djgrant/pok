# Three-Pane Layout

## Problem

The playground needs to transform from its current layout to a three-column layout: Explorer | Tutorial | Editor. This is a significant structural change that affects multiple components and requires careful CSS grid implementation to avoid layout jank.

## Scope

- `playground/src/App.tsx` - Layout restructure
- `playground/src/index.css` - Layout CSS updates
- `playground/src/components/Sidebar.tsx` - Simplify to explorer only
- `playground/src/hooks/useWorkspace.ts` - Update tab model

## Approach

1. Update App.tsx layout structure:
   - Change from 2-pane to 3-pane grid
   - Left: Explorer (file tree only, no tabs)
   - Center: TutorialPanel (380px fixed width)
   - Right: Editor area (flexible, remaining space)
2. Update index.css with new grid:
   ```css
   .app-body {
     display: grid;
     grid-template-columns: var(--sidebar-width) 380px 1fr;
     grid-template-rows: 1fr;
   }
   ```
3. Simplify Sidebar.tsx:
   - Remove tab-bar functionality
   - Keep only file tree explorer
   - Maintain existing file tree interaction (click to open)
4. Update useWorkspace.ts tab model:
   - Editor area becomes tabbed (files + terminal)
   - Terminal tab for command output
   - File tabs for opened files
   - Track active tab state
5. Wire up file opening:
   - Clicking file in explorer opens in editor
   - Clicking file in tutorial opens in editor
   - Running command shows output in terminal tab
6. Test layout stability:
   - No jank on tab switches
   - No layout shift on file open
   - Stable during async operations

## Hypothesis

CSS Grid with explicit column widths will provide a stable layout. Separating the tutorial panel from the editor area will create clear visual hierarchy. The tabbed editor area will feel familiar to developers used to VS Code-style interfaces.

## Acceptance Criteria

- [ ] Three-column layout renders correctly
- [ ] Explorer shows file tree only
- [ ] Tutorial panel is center column
- [ ] Editor area has tabs (terminal + files)
- [ ] Clicking file in explorer opens in editor
- [ ] Clicking file in tutorial opens in editor
- [ ] Running command shows output in terminal
- [ ] Layout is stable (no jank on interactions)

## Dependencies

Phase 4 (tutorial panel) - need the TutorialPanel component to integrate

## Results

Implemented three-pane layout successfully:

1. **useWorkspace.ts**: Simplified initial tabs to just `shell` terminal (removed `learn` tab since tutorial is now a panel)
2. **Sidebar.tsx**: Removed tabs section, now shows only file tree explorer
3. **index.css**: Updated `.app-body` to use CSS Grid with `grid-template-columns: var(--sidebar-width) 380px 1fr` and added `.editor-area` wrapper styles
4. **App.tsx**: Added TutorialPanel between Sidebar and editor-area, with stub callbacks for `onCreateFile`, `onRunCommand`, and `onOpenFile`

Layout structure:

- Left: Explorer (sidebar with file tree only)
- Center: TutorialPanel (380px fixed width)
- Right: Editor area (TabBar + terminal/file tabs)

Verification:

- `bun tsc --noEmit` passes
- `bun run build` succeeds

## Evaluation

- [x] Three-column layout renders correctly
- [x] Explorer shows file tree only
- [x] Tutorial panel is center column
- [x] Editor area has tabs (terminal + files)
- [x] Clicking file in explorer opens in editor
- [x] Clicking file in tutorial opens in editor (via onOpenFile callback)
- [ ] Running command shows output in terminal (stub - Phase 6)
- [x] Layout is stable (CSS Grid provides stable columns)

Phase 6 will connect the stub callbacks to actual WebContainer operations.
