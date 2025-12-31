# Tutorial Polish

## Problem

Multiple UX issues in the playground tutorial need to be fixed:

### Header Issues
1. **Empty box under "pok learn"** - The `app-header-tutorial-section` shows nothing when on the welcome section (before choosing a topic). It should show the current section title or be hidden.
2. **Header bottom border 1px off** - The tutorial header section's bottom border doesn't align perfectly with the sidebar header border.
3. **Progress bar stuck at ~5%** - The progress percentage isn't updating correctly as steps are completed.

### Tab Issues
4. **Tab filename border misaligned** - The bottom border of file tabs in the header doesn't align correctly.

### Tutorial Flow Issues
5. **File tab focus conflicts with instruction** - After creating a file, the tab is focused automatically, but the tutorial says "Click it to view the code" - this instruction is now redundant/confusing.
6. **Steps appear then immediately replaced** - Non-interactive steps (info, tip) auto-advance too quickly, appearing and disappearing before user can read them.
7. **No CTA when tutorial complete** - When the tutorial ends, there's no clear call-to-action or completion state.
8. **No navigation in tutorial** - Users can't go back to previous steps or sections.
9. **Tutorial suggests editing files** - The exit section says "Edit files in the sidebar" but the playground doesn't support file editing.

### Content Issues
10. **Tabs tutorial is pointless** - Remove the "Learn about tabs" option since tabs don't work in the browser playground.

## Scope

- `playground/src/App.tsx` - Header layout
- `playground/src/index.css` - Header alignment CSS
- `playground/src/components/TutorialPanel.tsx` - Tutorial UI, navigation, completion state
- `playground/src/components/TutorialPanel.css` - Tutorial styles
- `playground/src/hooks/useTutorialEngine.ts` - Auto-progress timing, progress calculation
- `playground/src/hooks/useTutorialActions.ts` - File creation behavior (don't auto-focus tab)
- `playground/src/tutorial/content.ts` - Remove tabs section, fix exit section text
- `playground/src/tutorial/engine.ts` - Navigation support

## Approach

### Phase 1: Content & Header Fixes
1. Remove "Learn about tabs" choice option from content.ts
2. Fix exit section text to not mention editing files
3. Fix header to show section title properly (hide when empty or show "Welcome")
4. Fix progress calculation (may need to track progress per-section differently)
5. Fix CSS border alignment issues

### Phase 2: Tutorial Flow Fixes
1. Increase AUTO_PROGRESS_DELAY for info/tip steps to give users time to read (e.g., 2000ms)
2. Don't auto-focus file tab after creation - let user click in explorer
3. Add prev/next navigation buttons to tutorial panel
4. Add completion state with CTA ("Start over" / "Explore freely")

## Hypothesis

1. The progress bar is stuck because it counts ALL steps across ALL sections, but only the current section's steps are being completed.
2. The 1px border issue is likely a CSS rounding or box-model issue in the header grid.
3. Auto-progress delay of 600ms is too fast for reading content - 2000ms would be better for info steps.
4. Removing file auto-focus will make the tutorial instruction flow naturally.

## Results

### Phase 1 Complete

**1. Removed "Learn about tabs" option** (`playground/src/tutorial/content.ts`)
- Removed `{ value: 'tabs', label: 'Learn about tabs' }` from welcomeSection options
- Removed entire `tabsSection` definition
- Removed `tabsSection` from `pokTutorial.sections` array
- Updated `stepNumber` and `totalSteps` in all sections (now 4 total instead of 5)

**2. Fixed exit section text** (`playground/src/tutorial/content.ts`)
- Changed tip from "Edit files in the sidebar..." to "Create new files using the tutorial or explore commands in the shell."

**3. Fixed header section title display** (`playground/src/App.tsx`)
- Added conditional rendering: hide section title when it equals "Welcome to pok"
- Now shows nothing in header section area during welcome, shows section title after user makes choice

**4. Fixed progress calculation** (`playground/src/tutorial/engine.ts`)
- Changed `getProgress()` to calculate based on current section only
- `total` = current section's step count
- `completed` = completed steps in current section
- Progress now updates correctly as user completes steps within each section

**5. Fixed CSS border alignment** 
- `playground/src/components/TutorialPanel.css`: Added explicit `box-sizing: border-box` to tutorial-panel-no-header pseudo-element
- `playground/src/index.css`: Removed `margin-bottom: -1px` from active tabs in header (`.app-header-right .tab-bar .tab-bar-tab-active`)

All changes type-check successfully.

## Evaluation

Phase 1 hypothesis confirmed:
1. **Progress bar fix** - The original implementation counted ALL steps (20+) but only completed steps in the current section (2-4). New implementation correctly tracks per-section progress.
2. **Border alignment** - Added explicit box-sizing and removed conflicting margin on header tabs.
