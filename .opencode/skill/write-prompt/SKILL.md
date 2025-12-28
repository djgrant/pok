---
name: write-prompt
description: Reference for delegating work to opencode subagents via `opencode run`
---

# Delegating to Subagents

Run `opencode run "{prompt}"` to spawn a subagent. The process exits when the agent completes.

## Referencing Work Packages

```
opencode run "Complete .opencode/work/todo/{package-name}.md"
```

## Resuming Sessions

If a process is interrupted, find and resume it:

```bash
opencode session list
opencode run "{prompt}" --session {id}
```

## File References

Include paths with `@` for context:

```
opencode run "Fix the bug in @packages/tabs-ink/src/tabbed-view.tsx"
```
