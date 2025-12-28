# pok

A file-based CLI framework for TypeScript.

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
