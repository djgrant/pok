# pok Codebase

## Quick Commands

```bash
pok build          # Build all packages
pok test           # Run all tests
pok check all      # Type check + format check
pok format         # Format code
pok clean          # Remove build artifacts
pok dev docs       # Start documentation site
pok dev interactive # Start interactive tutorial
```

## Package Overview

| Package | Purpose |
|---------|---------|
| `@openpok/core` | Core framework - routing, tasks, events. Zero TTY deps. |
| `@openpok/cmd` | Global CLI launcher |
| `@openpok/create` | Project scaffolding (`bun create @openpok/create`) |
| `@openpok/op` | 1Password integration |
| `@openpok/prompter-clack` | Interactive prompts adapter |
| `@openpok/reporter-clack` | Terminal output adapter |
| `@openpok/tabs-core` | Shared tabs state |
| `@openpok/tabs-ink` | Tabbed UI with Ink/React |
| `@openpok/tabs-opentui` | Tabbed UI with OpenTUI |

For detailed package docs, see `docs/packages/`.

## Key Directories

```
commands/           # pok's own CLI commands (file-based routing)
packages/
  core/src/
    lib/            # Core logic (command, task, env, router, runner)
    events/         # Event bus and types
    prompter/       # Abstract prompter interface
    tabs/           # Abstract tabs interface
docs/               # VitePress documentation
test/
  cases/            # Integration test cases
  commands/         # Command re-exports for testing
  utils/            # Shared test utilities
```

## Testing

Tests use Bun's test runner:

```bash
bun test                           # All tests
bun test packages/core/test/       # Package tests
bun test --watch                   # Watch mode
```

Integration tests in `test/cases/` verify full command execution.

Shared test utilities in `test/utils/`:
- `normalizeEvents` - Normalize events for assertions
- `createVirtualTerminal` - Mock terminal for testing

## Skills for Common Tasks

For adding commands or packages, load the relevant skill:
- `add-command` - How to add a new CLI command
- `add-package` - How to add a new package to the monorepo
