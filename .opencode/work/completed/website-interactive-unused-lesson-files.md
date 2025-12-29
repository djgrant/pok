# Work Package: Evaluate unused lesson markdown files

## Summary

The `packages/website-interactive/lessons/` directory contains markdown lesson files that are not being used. The tutorial content is instead embedded directly in `useWebContainer.ts`. This creates maintenance overhead and potential confusion.

## Context

- Unused files in `packages/website-interactive/lessons/`:
  - `01-first-command.md`
  - `02-arguments-and-flags.md`
  - `03-using-tasks.md`
  - `04-understanding-checks.md`
  - `05-working-with-environments.md`
  - `06-command-composition.md`

- The actual tutorial is embedded in `useWebContainer.ts` as the `learn.ts` command
- The SPEC.md describes the terminal-first approach without a sidebar

## Decision Needed

1. **Option A**: Remove the unused lesson files (they're not being used)
2. **Option B**: Use the lesson files as source of truth and generate learn.ts from them
3. **Option C**: Keep both but document why (perhaps for future use)

## Tasks

1. Decide on the approach
2. Either remove the files or integrate them

## Notes

- The lesson files contain different content than what's shown in the tutorial
- The lesson files include lessons not in the current tutorial (Tasks, Checks, Environments, Composition)
- This may be intentional - perhaps the files are for a future feature

## Output

**Decision: Option A - Remove unused lesson files**

### Analysis

1. **Content mismatch**: The lesson files use a different API style:
   - Lesson files: `export default defineCommand({ meta: { name: ... } })`
   - Actual tutorial: `export const command = defineCommand({ label: ... })`
   
2. **Syntax mismatch**: The lesson files use ESM syntax, but WebContainer requires CommonJS (see completed work package `website-interactive-esm-syntax.md`)

3. **SPEC compliance**: The SPEC.md explicitly states "What We Removed" includes sidebar lesson navigation. The markdown files were from the old design.

4. **Maintenance burden**: Having two sources of truth (lesson files + embedded learn.ts) creates confusion and maintenance overhead.

### Recommendation

Remove the `lessons/` directory entirely. The terminal-first design means all content should be in the embedded `learn.ts` command.

### Files to Remove
- `packages/website-interactive/lessons/01-first-command.md`
- `packages/website-interactive/lessons/02-arguments-and-flags.md`
- `packages/website-interactive/lessons/03-using-tasks.md`
- `packages/website-interactive/lessons/04-understanding-checks.md`
- `packages/website-interactive/lessons/05-working-with-environments.md`
- `packages/website-interactive/lessons/06-command-composition.md`

### Action Required

Run: `rm -rf packages/website-interactive/lessons/`

### Completed

**Date**: 2024-12-29

Action executed: `rm -rf packages/website-interactive/lessons/`

All 6 unused lesson markdown files have been removed:
- `01-first-command.md`
- `02-arguments-and-flags.md`
- `03-using-tasks.md`
- `04-understanding-checks.md`
- `05-working-with-environments.md`
- `06-command-composition.md`

The tutorial content remains embedded in `useWebContainer.ts` as the single source of truth.
