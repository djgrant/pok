# pok

pok is the TanStack of command line apps. It enables developers to:

### Goals

- quickly standup internal developer platforms
- reduce onboarding time
- reduce developer friction
- enable agents to discover a codebases capabilities
- enforce security on developer machines

## Non-Goals

- Replacing established CLI frameworks for simple scripts
- Building a general-purpose task runner
- Expanding support for the core runtime beyond Bun

## Structure

```
packages/
  core/             # Core framework (routing, tasks, events)
  create/           # Project scaffolding
  cmd/              # Global CLI launcher
  tabs-ink/         # Tabbed terminal UI (Ink)
  tabs-opentui/     # Tabbed terminal UI (OpenTUI)
  reporter-clack/   # Terminal output
  prompter-clack/   # Interactive prompts
commands/           # pok's own CLI commands
test/               # Integration tests
```

## Conventions

- ESM modules (`"type": "module"`)
- Strict mode enabled
- Zod v4 for all validation
- Prefer inference over explicit types

## Design Principles

1. _Schema is destiny_. Define intent once. Derive validation, types, UI, and everything else automatically.
2. _Convention over configuration_. Wiring code is intellectual waste. Structure is contract.
3. _Vertically-integrated abstractions_. Separate concerns, but couple features.
4. _Ceremony-free interfaces_. Don't make humans think about _how_ to do something. pok should bridge the gap between intent and execution.
5. _The principle of least API_. Provide the minimal API to balance extensibility with constraints.
6. _Falling into the pit of success_. Developers are lazy. Make it easy to do the right things (e.g. security), and hard to circumvent them.
