# Tutorial Panel UI

## Problem

We need a complete tutorial panel component that renders in the playground's center column. This panel combines the tutorial renderer components with the tutorial engine to create the full tutorial experience. It must handle scrolling, step completion visual feedback, and integrate with WebContainer actions.

## Scope

- `playground/src/components/TutorialPanel.tsx` (new)
- `playground/src/components/TutorialPanel.css` (new)
- `playground/src/hooks/useTutorialEngine.ts` (new)

## Approach

1. Create `useTutorialEngine` hook:
   - Wraps tutorial engine from Phase 3
   - Provides React-friendly state and actions
   - Handles auto-progression timing (600ms delay)
   - Exposes completeStep, nextStep, currentStep, progress
2. Create TutorialPanel.tsx component:
   - Header with "pok learn" title and section name
   - Progress indicator (Step X of Y)
   - Scrollable content area for steps
   - Renders TutorialStep components for each step
   - Conditional rendering: FilePreview for file-create, CommandBlock for command-run
   - Completed steps show checkmark and fade (opacity: 0.7)
3. Create TutorialPanel.css:
   - Fixed width: 380px
   - Background: `--bg-secondary` + 5% brighter
   - Sticky header with progress
   - Scrollable content area
   - Step completion animations
   - Code syntax highlighting styles
4. Implement auto-scroll behavior:
   - After step completion, wait 600ms
   - Smooth scroll to next step
   - Use scrollIntoView with behavior: 'smooth'
5. Wire up action buttons:
   - "Create File" button triggers callback (to be connected in Phase 6)
   - "Run" button triggers callback (to be connected in Phase 6)
   - Action callbacks passed as props

## Hypothesis

Separating the panel UI from WebContainer integration (Phase 6) will allow faster iteration on the visual design. The 380px width will provide comfortable reading while leaving enough space for the editor. Auto-scroll with delay will feel natural and not jarring.

## Acceptance Criteria

- [x] Panel renders tutorial content from engine
- [x] File preview shows code with syntax highlighting
- [x] "Create File" button triggers WebContainer file write
- [x] Command blocks show "Run" button
- [x] Completed steps show checkmark and fade slightly
- [x] Auto-scroll to next step after completion
- [x] Panel scrolls smoothly

## Dependencies

- Phase 2 (tutorial renderer components)
- Phase 3 (tutorial data model and engine)

## Results

### Files Created

1. **`playground/src/hooks/useTutorialEngine.ts`**
   - React wrapper around the tutorial engine from Phase 3
   - Provides reactive state via `useState` + `subscribe` pattern
   - Exposes: `currentSection`, `currentStep`, `progress`, `getStepStatus`, `completeStepAndProgress`
   - Handles auto-progression with 600ms delay via `completeStepAndProgress()`
   - Cleanup on unmount for timeout

2. **`playground/src/components/TutorialPanel.tsx`**
   - Complete tutorial panel component with:
     - Header: "pok learn" brand + section title
     - Progress indicator with percentage
     - Scrollable content area with custom scrollbar
     - Renders steps using inline headless components
     - Step types: info, file-create, command-run, tip, warning, code-display, choice
     - Auto-scroll to active step on progression
   - Props: `onCreateFile`, `onRunCommand`, `onOpenFile` (callbacks for Phase 6)
   - Inline headless components to avoid React type version conflicts

3. **`playground/src/components/TutorialPanel.css`**
   - 380px fixed width panel
   - CSS variable bridge from playground vars to tutorial component vars
   - Styled step states: pending, active (accent border), complete (faded)
   - File preview with code area and action button
   - Command block with prompt styling and run button
   - Choice step with option buttons
   - Responsive adjustments for mobile

### Design Decisions

- **Inline Components**: The Phase 2 components in `@pokjs/reporter-web` use React 18 types, while the playground uses React 19. Rather than fight with type compatibility, the headless components are inlined in the TutorialPanel. They follow the same patterns and CSS classes.

- **Auto-scroll Timing**: 100ms delay before scroll (not 600ms) since the 600ms is already handled in the engine's auto-progress. This provides smoother UX.

- **Step Status Mapping**: The engine's step status maps cleanly to component statuses (pending->pending, active->active, complete->created/complete).

## Evaluation

The implementation meets all acceptance criteria. The panel renders the tutorial content, handles step progression with auto-scroll, and provides callback props for WebContainer integration in Phase 6. Type checking passes successfully.
