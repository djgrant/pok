---
name: add-command
description: When an internal script or capability is added to the monorepo, use this skill to create a new CLI command
---

# Adding a Command

The pok monorepo eats its own dogfood.

Currently, we have a simple flat structure of commands and do not utilise tasks and envs.

## File Naming

```
commands/
├── build.ts           # pok build
├── check.ts           # pok check (parent command)
├── check.types.ts     # pok check types
├── check.format.ts    # pok check format
└── db.migrate.ts      # pok db migrate
```
