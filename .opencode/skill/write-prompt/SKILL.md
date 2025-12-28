---
name: write-prompt
description: Reference for delegating work to opencode subagents via `opencode run`
---

# Delegating to Subagents

Run `opencode run "@agent {prompt}"` to spawn a subagent. The `@agent` mention routes to the specified subagent. The process exits when the agent completes.

## Available Agents

- `@build` - Runs builds, checks, fixes issues
- `@tester` - Writes and runs tests
- `@reviewer` - Reviews code (read-only)
- `@documenter` - Updates documentation
- `@architect` - Plans architecture, reads knowledge first

## Delegating Work Packages

```bash
opencode run "@build Complete .opencode/work/todo/{name}.md. Load the work-package skill."
```

For test-related work:
```bash
opencode run "@tester Complete .opencode/work/todo/{name}.md. Load the work-package skill."
```

## Resuming Sessions

If a process is interrupted:

```bash
opencode session list
opencode run "{prompt}" --session {id}
```

## File References

Include paths with `@` for context:

```
opencode run "Fix the bug in @packages/tabs-ink/src/tabbed-view.tsx"
```
