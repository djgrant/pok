---
name: spawn-subagent
description: 
---

Run `opencode run "(@agent ){prompt}"` to spawn a subagent. 

- The `@agent` tag is optional and routes to a specifialised subagent. 
- The process exits when the agent completes its work.

## Selecting Agent Types

For most tasks, the default agent is the best choice. You do not need to @-mention it.

### Specialised Agents

- `@ux` - Reviews design 
- `@review` - Reviews code (read-only)
- `@document` - Updates documentation
- `@architect` - Plans architecture, reads knowledge first

## Loading Skills

```bash
opencode run "1) Load the work-package skill. 2) Complete .opencode/work/todo/{name}.md."
```

With a specialised agent:

```bash
opencode run "@design 1) Load the work-package skill. 2) Complete .opencode/work/todo/{name}.md."
```

## Resuming Agent Sessions

Agent sessions are snapshotted, so, if a process is interrupted, work can by resumed by finding the session ID, and then re-prompting it to continue:

```bash
opencode session list
opencode run "continue" --session {id}
```

The prompt "continue" tells the agent to continue working where it left off.
