# pok Agent Guide

pok is a file-based CLI framework for TypeScript. This directory contains everything agents need to work effectively on this codebase.

## Invoking Agents

Use `@mention` to invoke a specific agent:

```
@delegator Break this into work packages and delegate
@build Fix the type errors in packages/core
@tester Add tests for the new feature
@reviewer Review the changes in this PR
```

In `opencode run`, include the mention in the prompt:

```bash
opencode run "@build Fix type errors. Load the work-package skill."
```

## What's Here

```
.opencode/
├── agents.md        # This file - orientation
├── codebase.md      # How to build, test, and navigate the repo
├── conventions.md   # Coding standards and patterns
├── vision.md        # Project goals and design principles
│
├── agent/           # Custom agents (build, reviewer, tester, documenter, architect)
├── command/         # Slash commands (/check, /test, /docs)
├── skill/           # Loadable skills
│
├── work/            # Work packages
│   ├── todo/        # Planned work
│   ├── in-progress/ # Active work
│   └── completed/   # Done (for reference)
│
└── knowledge/       # Lessons learned
```

## Work Packages

When working on a significant task, create or update a work package:

**Location:** `.opencode/work/{todo,in-progress,completed}/`

**Format:**
```markdown
# [Title]

**Package:** core | create | tabs-ink | etc.

## Problem
[What's wrong or missing]

## Current Approach
[How it works now, if applicable]

## Proposed Approach
[What we'll do]

## Why This Approach
[Brief rationale]
```

Move files between directories as work progresses.

## Knowledge (Lessons Learned)

When you learn something important, add it to knowledge:

**Location:** `.opencode/knowledge/YYYY-MM-DD-short-name.md`

**Format:**
```markdown
# [One-line title]

**Date:** YYYY-MM-DD
**Package:** core | create | etc.

[One or two sentences. No more than needed.]
```

Keep lessons brief. Over-learning is worse than under-learning.

All agents may write to the knowledge directory.
