# Playground V3 Polish

## Problem

Several small issues were identified after the V3 implementation:

1. **Explorer container and tab container don't align** - Visual misalignment between the sidebar and main content area
2. **Terminals restart on every state change** - Clicking anywhere causes terminals to restart, losing state
3. **Tab title should show current running process** - Currently shows static "pok learn" / "shell" but should reflect what's actually running
4. **No indication of completed tasks** - When tutorial steps complete, there's no visual feedback
5. **Split screen between pok learn and default shell** - Should show both side by side by default
6. **Treat pok learn as a "task"** - Rather than a persistent shell, pok learn should run once and complete, not be kept alive
7. **Cmd+1/2/etc hijacks browser shortcuts** - These are standard browser tab-switching shortcuts and shouldn't be overridden

## Scope

Files likely to modify:

- `playground/src/App.tsx` - Default split view state
- `playground/src/index.css` - Alignment fixes
- `playground/src/components/Terminal.tsx` - Fix re-rendering, process title tracking
- `playground/src/components/TabBar.tsx` - Dynamic titles
- `playground/src/components/TabContent.tsx` - Prevent unnecessary re-renders
- `playground/src/hooks/useWorkspace.ts` - Split view default, task completion state

## Approach

### Issue 1: Alignment

- Inspect CSS and fix grid/flexbox alignment between sidebar and content

### Issue 2: Terminal restarts

- Likely a React re-rendering issue
- Terminal component may be unmounting/remounting on state changes
- Need to memoize or use stable keys
- Consider using refs to preserve terminal instances

### Issue 3: Dynamic tab titles

- Track the running process in terminal
- Update tab label when process changes
- Could use xterm's title escape sequence or track spawn commands

### Issue 4: Completed task indication

- Add visual state for completed tasks in sidebar
- Could use checkmark icon or different styling

### Issue 5: Default split view

- Change initialState to have splitTabId set to 'shell'
- Ensure split view renders correctly on load

### Issue 6: pok learn as task

- Change pok learn from persistent shell to one-shot task
- When command completes, show completion state
- Don't allow typing in completed task terminal

### Issue 7: Keyboard shortcuts

- Remove Cmd+1-9 tab switching (conflicts with browser)
- Keep Cmd+B (sidebar), Cmd+K (clear), Cmd+W (close tab)
- Consider alternative shortcuts or remove tab switching shortcuts entirely
- Update footer hint text

## Hypothesis

These are mostly React rendering optimization issues and UX polish. The terminal restart issue is likely the most impactful - probably caused by component re-mounting due to key changes or parent re-renders.

## Results

All 7 issues have been fixed and verified:

### Issue 1: Alignment ✅

- Fixed sidebar header height to match tab bar height using `var(--tab-bar-height)`
- Updated flexbox alignment for consistent positioning

### Issue 2: Terminal Stability ✅

- Root cause: React StrictMode's double-mounting behavior was causing duplicate process spawns
- Added `processStartingRef` to prevent race conditions during async setup
- Removed process cleanup from effect cleanup (terminals persist until page unload)
- Terminals now maintain state across tab switches

### Issue 3: Dynamic Tab Titles ✅

- Fixed `setTitle()` in learn.ts to use `console.log()` instead of `process.stdout.write()`
- Updated title regex to handle trailing newlines
- Tab titles now update to reflect current step (e.g., "pok learn - Commands")

### Issue 4: Completed Task Indication ✅

- Added `taskStatus` and `exitCode` fields to Tab type
- TabBar displays checkmark for completed tasks, X for failed
- Tutorial steps show visual completion feedback

### Issue 5: Default Split View ✅

- Changed initial state to have `splitTabId: 'shell'`
- Both terminals visible side-by-side on initial load

### Issue 6: pok learn as Task ✅

- Added explicit `process.exit(0)` when tutorial completes
- Terminal detects exit and disables input via `isCompletedRef`
- Shows "✓ Task completed" message after completion

### Issue 7: Keyboard Shortcuts ✅

- Removed Cmd+1-9 handlers that conflicted with browser tab switching
- Kept Cmd+B (sidebar), Cmd+K (clear), Cmd+W (close)
- Updated footer to remove Cmd+1-9 hints

## Evaluation

### All Issues Resolved ✅

The polish pass successfully addressed all 7 issues:

1. **Visual alignment** - Headers now properly aligned
2. **Terminal stability** - No more restarts when switching tabs (StrictMode-safe)
3. **Dynamic titles** - Tab titles reflect current tutorial step
4. **Task completion** - Clear visual feedback for completed tasks
5. **Split view** - Default layout shows both terminals
6. **Task behavior** - pok learn properly exits and disables input
7. **Keyboard shortcuts** - No longer conflicts with browser shortcuts

### Key Learnings

1. **React StrictMode** - Double-mounting in development can cause issues with side effects like process spawning. Using refs to track "already started" state prevents duplicates.

2. **WebContainer output** - `console.log()` is more reliably captured than `process.stdout.write()` for terminal output in WebContainer.

3. **Process lifecycle** - Need explicit `process.exit()` for commands to properly signal completion to the parent.

### Impact

The playground now feels polished and professional - terminals persist, titles update dynamically, and the task-based tutorial flow is clear.
