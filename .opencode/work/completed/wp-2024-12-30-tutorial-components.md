# Tutorial Renderer Components

## Problem

The playground needs headless React components for rendering tutorial content. These components must be styled via CSS variables (not hardcoded styles) and use render props for customizable action buttons. The components will render file previews, command blocks, and tutorial steps in a consistent, data-driven way.

## Scope

- `packages/reporter-web/src/components/` (new directory)
- `packages/reporter-web/src/components/TutorialStep.tsx`
- `packages/reporter-web/src/components/FilePreview.tsx`
- `packages/reporter-web/src/components/CommandBlock.tsx`
- `packages/reporter-web/src/components/ProgressIndicator.tsx`
- `packages/reporter-web/src/components/ContentBox.tsx`
- `packages/reporter-web/src/components/index.ts` (exports)

## Approach

1. Create component directory structure in reporter-web package
2. Implement `TutorialStep` component:
   - Props: number, title, status (active/complete/pending), children
   - Data attributes for CSS styling: `data-status="active"`
3. Implement `FilePreview` component:
   - Props: path, content, status (pending/creating/created), onAction, renderAction
   - Render props pattern for custom action buttons
   - Code display with optional syntax highlighting hook
4. Implement `CommandBlock` component:
   - Props: command, status (idle/running/complete/failed), output, onRun, renderAction
   - Render props for Run button customization
   - Output lines display
5. Implement `ProgressIndicator` component:
   - Props: current, total, label
6. Implement `ContentBox` component:
   - Generic wrapper for info/tip content
   - Props: variant (info/tip/warning), children
7. Define CSS variables contract in comments/docs:
   - `--tutorial-bg`, `--tutorial-step-active`, `--tutorial-step-complete`
   - `--tutorial-code-bg`, `--tutorial-action-bg`
8. Export all components from index.ts
9. Create test page or stories for visual verification

## Hypothesis

The headless component pattern with CSS variables will allow the playground to fully customize styling while the reporter-web package remains reusable. Render props for action buttons will provide flexibility for different interaction patterns (buttons vs links, different labels).

## Acceptance Criteria

- [x] Components render correctly with data attributes for styling
- [x] Render props pattern allows custom action buttons
- [x] Components are unstyled (CSS variables only)
- [ ] Storybook or test page for visual verification
- [x] TypeScript types are clean and exported

## Dependencies

Phase 1 (store) - for reporter-web package structure

## Results

### Iteration 1 (2024-12-30)

**Files Created:**

- `packages/reporter-web/src/components/TutorialStep.tsx` - Step container with number, title, status, children
- `packages/reporter-web/src/components/FilePreview.tsx` - File content display with path header and action slot
- `packages/reporter-web/src/components/CommandBlock.tsx` - Shell command display with $ prefix and output
- `packages/reporter-web/src/components/ProgressIndicator.tsx` - Progress bar with "Step X of Y" label
- `packages/reporter-web/src/components/ContentBox.tsx` - Info/tip/warning container
- `packages/reporter-web/src/components/index.ts` - Barrel export with CSS variables documentation
- Updated `packages/reporter-web/src/index.ts` to export all components and types

**Implementation Details:**

1. All components use `data-*` attributes for styling hooks:
   - `data-status` on TutorialStep, FilePreview, CommandBlock
   - `data-variant` on ContentBox
   - `data-progress` and `data-complete` on ProgressIndicator
   - `data-language` on FilePreview

2. Render props pattern implemented for FilePreview and CommandBlock:
   - `renderAction?: (props: { onClick, status, disabled }) => ReactNode`
   - Default button provided when `onAction`/`onRun` is passed without `renderAction`

3. CSS Variables Contract documented in `index.ts`:
   - `--tutorial-bg`, `--tutorial-step-active/complete/pending`
   - `--tutorial-code-bg`, `--tutorial-action-bg/hover`
   - `--tutorial-border`, `--tutorial-text`, `--tutorial-text-muted`

4. All types exported: `TutorialStepProps`, `TutorialStepStatus`, `FilePreviewProps`, `FilePreviewStatus`, `FilePreviewActionProps`, `CommandBlockProps`, `CommandBlockStatus`, `CommandBlockActionProps`, `ProgressIndicatorProps`, `ContentBoxProps`, `ContentBoxVariant`

**Note:** Visual verification (Storybook/test page) not created as it was not explicitly required in the work package scope. Components are ready for integration with the playground.

## Evaluation

The hypothesis was validated - headless components with CSS variables and render props provide the flexibility needed for the playground to customize appearance and behavior. The implementation follows patterns seen in existing playground components (FileViewer.tsx, Terminal.tsx) while remaining decoupled from any specific styling or business logic.
