# Tutorial Data Model

## Problem

The current playground tutorial (learn.ts) outputs ANSI terminal content directly. We need to migrate to a structured data model that separates content from rendering. This enables the tutorial to be rendered as React components while keeping content maintainable and testable.

## Scope

- `playground/src/tutorial/` (new directory)
- `playground/src/tutorial/types.ts` - Tutorial step type definitions
- `playground/src/tutorial/content.ts` - Actual tutorial content as data
- `playground/src/tutorial/engine.ts` - Tutorial progression logic

## Approach

1. Create tutorial directory in playground/src
2. Define TypeScript types in types.ts:
   - `TutorialStep` discriminated union: info, file-create, command-run, tip, choice
   - `TutorialSection` with id, title, steps array
   - `Tutorial` with id, sections array
3. Implement tutorial engine in engine.ts:
   - State: currentSection, currentStep, completedSteps Set
   - Actions: completeStep(), nextStep(), goToSection()
   - Derived: canProgress, progress { completed, total }
   - Auto-progression with 600ms delay before scrolling to next step
4. Migrate content from learn.ts to content.ts:
   - Extract each tutorial step as structured data
   - File creation steps: path, content, description
   - Command run steps: command, description
   - Info/tip steps: content strings
5. Export tutorial instance and engine factory

## Hypothesis

Separating tutorial content into a data model will make updates trivial (change data, not code) and enable testing the tutorial flow without rendering. The engine pattern will cleanly encapsulate progression logic, making it easy to add features like persistence or analytics later.

## Acceptance Criteria

- [x] Tutorial content migrated from learn.ts ANSI output to structured data
- [x] Engine tracks progress and handles auto-progression
- [x] 600ms pause before auto-scrolling to next step
- [x] Content is separate from rendering (data-driven)
- [x] Types are clean and well-documented

## Dependencies

None (can run in parallel with Phase 2)

## Results

### Files Created

1. **`playground/src/tutorial/types.ts`** - Type definitions
   - `TutorialStep` discriminated union with 7 step types: `info`, `file-create`, `command-run`, `tip`, `warning`, `code-display`, `choice`
   - `TutorialSection` with id, title, stepNumber, totalSteps, and steps array
   - `Tutorial` root type with id, title, description, sections
   - `TutorialState` and `TutorialProgress` for engine state management
   - `stepId()` helper for unique step identification

2. **`playground/src/tutorial/content.ts`** - Tutorial content data
   - Code templates: `HELLO_CODE`, `GREET_CODE`, `DEV_CODE`, `TASK_CODE`
   - 6 sections extracted from learn.ts:
     - `welcome` - Welcome message and navigation choice
     - `create` - Create your first command (hello.ts)
     - `args` - Add flags and validation (greet.ts)
     - `tabs` - Learn about tabs (code display only, with warning)
     - `tasks` - Understand tasks (code display)
     - `exit` - Free exploration
   - `pokTutorial` - Complete tutorial instance
   - Helper functions: `getSectionById()`, `getSectionIndexById()`

3. **`playground/src/tutorial/engine.ts`** - Tutorial progression engine
   - `createTutorialEngine()` factory function
   - State management: currentSectionIndex, currentStepIndex, completedSteps Set, selectedChoice
   - Actions: `completeStep()`, `nextStep()`, `previousStep()`, `goToSection()`, `goToSectionByIndex()`, `selectChoice()`, `reset()`
   - Derived state: `canProgress()`, `getProgress()`, `isAtStart()`, `isAtEnd()`
   - Subscribe/notify pattern for state change listeners
   - `scheduleAutoProgress()` helper with 600ms default delay
   - `AUTO_PROGRESS_DELAY` constant exported for configuration

4. **`playground/src/tutorial/index.ts`** - Barrel exports
   - All types, content, and engine exports consolidated

### Design Decisions

- Added `warning` and `code-display` step types beyond the original spec to better represent learn.ts content (tabs section has warnings, some sections show code without creating files)
- Engine uses subscribe/notify pattern for framework-agnostic reactivity (can be wrapped in React hooks or used standalone)
- Steps are identified by `sectionIndex-stepIndex` composite keys for tracking completion
- Choice steps require selection before progression (`canProgress()` checks this)

## Evaluation

All acceptance criteria met. The tutorial data model cleanly separates content from rendering logic. The engine provides a testable, stateful interface for controlling tutorial flow. TypeScript types pass validation with no errors.
