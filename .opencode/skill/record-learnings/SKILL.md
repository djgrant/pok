---
name: self-improve
description: When you learn something worth remembering, or the project changes, or you find a way to improve the agentic system, use this skill to update agent documentation
---

# Updating Agent Documentation

This skill covers when and how to update the files in `.opencode/`.

## Files and Their Purpose

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `agents.md` | Directory orientation | Rarely - only when structure changes |
| `conventions.md` | Coding standards | When patterns evolve |
| `vision.md` | Project goals | When there is a fundamental change in direction and it is explicitly requested by the user |
| `knowledge/*.md` | Lessons learned | When you learn something (not general knowledge) that will likely be worth noting for posterity |
| `work/*.md` | Work packages | When you are asked or need to track your work |

## How to Update

Keep updates minimal. These documents should be scannable, not exhaustive.

### Adding Knowledge

The knowledge document should be understood by its filename.

```
template: {yyyy-mm-dd}-(package:{package})-({title})-(tags:{tags}).md
example: 2025-12-25-(package:core)-(event ordering)-(tags:adapators,emit,sync).md
```

The document should contain metadata and a very concise record of the learning.

```markdown
---
date: yyyy-mm-dd
package: core | create | etc.
tags:
 - tag 1
 - tag 2
---

# [title]

[One or two sentences. No more than needed.]
```

### Updating Codebase/Conventions

- Make surgical edits, don't rewrite sections
- Preserve existing structure
- Reference specific code when possible
- Keep it very concise
