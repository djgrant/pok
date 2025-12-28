---
name: update-docs
description: Guidelines for updating agent documentation in .opencode/
---

# Updating Agent Documentation

This skill covers when and how to update the files in `.opencode/`.

## Files and Their Purpose

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `agents.md` | Directory orientation | Rarely - only when structure changes |
| `codebase.md` | Build/test commands, package overview | When workflows change |
| `conventions.md` | Coding standards | When patterns evolve |
| `vision.md` | Project goals | **User approval required** |
| `knowledge/*.md` | Lessons learned | Freely - add when you learn something |
| `work/*.md` | Work packages | Freely - track your work |

## When to Update

**Update freely:**
- `knowledge/` - Add lessons when you learn something worth remembering
- `work/` - Track work packages as you progress

**Update when needed:**
- `codebase.md` - New commands, changed workflows, new packages
- `conventions.md` - New patterns established, existing patterns clarified

**Requires user approval:**
- `vision.md` - Fundamental direction changes must be explicitly requested by the user, or ask first if ambiguous

## How to Update

Keep updates minimal. These documents should be scannable, not exhaustive.

### Adding Knowledge

```markdown
# [One-line title]

**Date:** YYYY-MM-DD
**Package:** core | create | etc.

[One or two sentences. No more than needed.]
```

### Updating Codebase/Conventions

- Make surgical edits, don't rewrite sections
- Preserve existing structure
- Reference specific code when possible

### Vision Changes

If you believe the vision needs updating:
1. Ask the user first: "I noticed X suggests we should reconsider Y in the vision. Should I update it?"
2. Only proceed with explicit approval
3. Document the reasoning in a knowledge entry
