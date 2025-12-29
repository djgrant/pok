# Test Delegate + Browser Integration

## Problem
Validate that the delegate agent can successfully:
1. Load skills automatically based on task
2. Run a hypothesis-driven loop
3. Take screenshots and observe state
4. Create work packages for issues found
5. Delegate fixes to subagents

## Scope
- `.opencode/` configuration files
- `packages/website-interactive/` (test subject)

## Iterations

### 1. First experiment - explicit skill loading
- Prompt: `@delegate Load the iterate and browser skills.`
- Result: PARTIAL - Skills loaded but agent asked for task

### 2. Second experiment - explicit task with skill loading
- Prompt: `@delegate Load the iterate and browser skills. Visually test...`
- Result: FAIL - Agent did work itself instead of delegating
- Root cause: Instructions didn't prohibit direct work

### 3. Third experiment - updated delegate with tool restrictions
- Changes made:
  - Added `tools: { write: false, edit: false }` to delegate.md
  - Updated description to trigger pattern
  - Updated skill descriptions to trigger patterns
- Prompt: `@delegate visually review interactive website, determine issues, and work on improvements`
- Result: **SUCCESS**

## Output

### Evidence of Success

1. **Skills loaded automatically** - Agent loaded `work-package` skill without being told
2. **Work packages created** - Multiple packages in `todo/`
3. **Delegation occurred** - Session `ses_496bc649bffe5nmowSYXTBSLJB` shows subagent was spawned:
   ```
   "Complete the work package at .opencode/work/todo/website-interactive-esm-syntax.md. Load the work-package skill."
   ```
4. **Work completed via subagent** - ESM work package was completed by build agent
5. **Packages moved to completed** - Proper lifecycle followed

### What Worked
- Delegate observed state (took screenshots)
- Delegate created work packages
- Delegate spawned subagents to do work
- Subagents followed work-package skill (moved files, wrote output)
- Work got done without delegate editing files directly

### Key Findings
- **Tool restrictions work** - `write: false, edit: false` prevented delegate from doing work itself
- **Trigger descriptions help** - Descriptive skill descriptions triggered automatic loading
- **Delegation happened** - Subagents were spawned and completed work packages

### Remaining Work
- `website-interactive-unused-lesson-files.md` was completed (files removed)
- ESM issue was investigated and closed (CommonJS is intentional for WebContainer)
- Visual review completed all SPEC checks
