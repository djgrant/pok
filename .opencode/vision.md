# pok Vision

## What pok Is

pok is the Next.js of command line apps. 

It allows developers to :
- quickly standup internal developer platforms
- reduce onboarding time
- reduce ongoing developer friction
- enable agents to discover a codebases capabilities
- enforce security on developer machines

## Design Principles

1. **File-based routing** - Commands discovered from the filesystem, not registered
2. **Type-safe by default** - Zod schemas provide runtime validation and TypeScript inference
3. **Interactive when needed** - Missing flags prompt users instead of showing errors
4. **Beautiful output** - Event-driven architecture allows swappable UI adapters
5. **Composable** - Tasks, environments, and checks are reusable building blocks
6. **Core is UI-agnostic** - Zero TTY dependencies in `@openpok/core`

## Goals

- Make CLI development as smooth as web development
- Eliminate boilerplate while keeping things explicit
- Support complex multi-process dev environments (tabbed terminals)
- Enable beautiful, accessible terminal UIs

## Non-Goals

- Replacing established CLI frameworks for simple scripts
- Building a general-purpose task runner
- Expanding support for the core runtime beyond Bun
