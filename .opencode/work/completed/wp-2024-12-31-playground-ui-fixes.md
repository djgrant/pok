# Playground UI Fixes

## Problem

The playground has four issues that need to be addressed:

### 1. Layout - Header Space Utilization

The app header ("pok playground") has unused space on the right side. The tutorial panel title ("pok learn Create your first command") and the shell tabs should be pushed up into this header row to create a unified header bar.

Currently:

- Row 1: "pok playground" header with empty space
- Row 2: "pok learn..." title in tutorial panel | "shell" tab in editor area

Should be:

- Row 1: "pok playground" | "pok learn..." | "shell" tab (all in one header row)

The tutorial section's bottom border should align exactly with the border below "EXPLORER" in the sidebar.

### 2. Commands Folder Expanded by Default

The `commands/` folder in the file explorer should be expanded by default when the playground loads. Currently it starts collapsed.

### 3. Tutorial Steps Revealed Prematurely

When the user selects an option in the tutorial choice step, ALL following steps are immediately displayed. Steps should only be revealed one at a time as each previous step is completed.

The issue is that the TutorialPanel renders ALL steps in the section, showing them regardless of whether prior steps are complete. It should only render steps up to and including the current active step.

### 4. Tutorial Doesn't Progress After Command Runs

When the user clicks "Run" on the `pok hello` command block, the tutorial does not automatically progress to the next step after the command completes. The `completeStepAndProgress()` function is called but something prevents advancement.

## Scope

- `playground/src/App.tsx`
- `playground/src/index.css`
- `playground/src/components/TutorialPanel.tsx`
- `playground/src/components/TutorialPanel.css`
- `playground/src/components/TabBar.tsx` (may need to move into header)
- `playground/src/hooks/useWorkspace.ts`
- `playground/src/hooks/useTutorialEngine.ts`

## Approach

Split into two phases:

### Phase 1: Layout Fixes

1. Restructure header using CSS Grid to place tutorial title and tab bar in the same row as the app header
2. Align tutorial section's bottom border with the "EXPLORER" border in the sidebar
3. Set commands folder to be expanded by default

### Phase 2: Tutorial Logic Fixes

1. Filter rendered steps to only show completed steps and the current active step
2. Debug and fix the command completion progression issue

## Hypothesis

1. The header can be restructured using CSS Grid to place tutorial title and tab bar in the same row as the app header
2. Setting `expandedFolders: new Set(['commands'])` in initial state will expand commands folder by default
3. Filtering rendered steps to only show `stepIndex <= currentStepIndex` will fix premature reveal
4. The command completion may not be triggering properly because the async flow doesn't wait for terminal output or there's a state update timing issue

## Results

### Phase 1: Layout Fixes - Completed

**Files Modified:**

1. `playground/src/hooks/useWorkspace.ts` - Changed `expandedFolders: new Set()` to `new Set(['commands'])` to expand commands folder by default
2. `playground/src/App.tsx` - Restructured header layout with 3 sections:
   - Left: "pok playground" wordmark (aligned with sidebar)
   - Center: Tutorial title + progress (aligned with tutorial panel)
   - Right: TabBar + Reset button (aligned with editor area)
3. `playground/src/index.css` - Updated CSS with:
   - 3-column grid layout for `.app-header` matching `.app-body` columns
   - New styles for `.app-header-center`, `.app-header-right`
   - Progress indicator styles for header context
   - Responsive adjustments for mobile (hiding center section, showing tab bar in editor)
4. `playground/src/components/TutorialPanel.tsx` - Added:
   - `externalHeader` prop to conditionally hide internal header
   - `useTutorialHeaderInfo()` hook to share header data
   - Exported `ProgressIndicator` component for reuse
5. `playground/src/components/TutorialPanel.css` - Added `.tutorial-panel-no-header` class that creates a 36px pseudo-element header to align with sidebar header

**Changes Summary:**

- Header now uses CSS Grid with 3 columns matching sidebar/tutorial/editor widths
- Tutorial title and progress moved from TutorialPanel internal header to app header center
- TabBar moved from editor area to app header right section
- Tutorial panel has a blank header row (36px) to align borders with sidebar "EXPLORER" header
- Commands folder is now expanded by default
- Mobile layout adjusted to hide center section and show tab bar in editor area

**Build Status:** TypeScript compilation and Vite build both succeed

## Evaluation

Phase 1 hypothesis confirmed:

1. CSS Grid with matching column widths creates aligned header sections
2. `expandedFolders: new Set(['commands'])` correctly expands commands folder on load
3. Border alignment achieved via pseudo-element matching `--tab-bar-height` (36px)

Phase 2 hypothesis partially confirmed: 3. Filtering steps to `stepIndex <= currentStepIndex` fixes premature reveal - **confirmed** 4. The progression issue was NOT a state timing issue but rather a fundamental design gap - non-interactive steps (info, tip, warning, code-display) were never being completed, causing `currentStepIndex` to remain at 0 while action steps at higher indices were visible. The fix required auto-completing non-interactive steps when they become active.

**All four issues addressed:**

- [x] Header space utilization (Phase 1)
- [x] Commands folder expanded by default (Phase 1)
- [x] Tutorial steps revealed prematurely (Phase 2)
- [x] Tutorial doesn't progress after command runs (Phase 2)

**Remaining for Phase 2:**

- Tutorial steps premature reveal (issues #3)
- Tutorial command completion progression (issue #4)

### Phase 2: Tutorial Logic Fixes - Completed

**Root Cause Analysis:**

The two issues were related:

1. **Premature step reveal**: `TutorialPanel.tsx` rendered ALL steps in a section with `.map()`, regardless of whether prior steps were completed. The step status was calculated but not used to filter which steps to show.

2. **Tutorial not progressing**: This was caused by non-interactive steps (info, tip, warning, code-display) never being completed. The tutorial flow is:
   - User selects "Create your first command" choice
   - `goToSection('create')` sets `currentStepIndex: 0`
   - Step 0 is an `info` step with no action button
   - Step 1 is a `file-create` step with a "Create" button
   - Due to the premature reveal bug, step 1 was visible
   - User clicks "Create" on step 1
   - `handleCreateFile` checks `stepIndex === currentStepIndex` → `1 === 0` is FALSE
   - `completeStepAndProgress()` was never called because the indices didn't match
   - The same pattern affected `command-run` steps

**Files Modified:**

1. `playground/src/components/TutorialPanel.tsx` (lines 478-497):
   - Changed `.map()` to `.filter().map()`
   - Filter: `stepIndex <= currentStepIndex` ensures only completed and current steps are rendered
   - Pending steps (stepIndex > currentStepIndex) are not rendered at all

2. `playground/src/hooks/useTutorialEngine.ts` (new useEffect after line 87):
   - Added auto-completion for non-interactive steps
   - When current step is `info`, `tip`, `warning`, or `code-display`:
     - After 100ms delay (to allow rendering), mark step as complete
     - After `AUTO_PROGRESS_DELAY` (600ms), call `nextStep()` if `canProgress()` returns true
   - This ensures the tutorial automatically advances through informational steps
   - Only `file-create`, `command-run`, and `choice` steps require user action

**Build Status:** TypeScript compilation and Vite build both succeed
