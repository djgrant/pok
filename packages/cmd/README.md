# pokit

Global CLI launcher for pok. Install once, run anywhere.

## Installation

```bash
bun add -g pokit
```

## Usage

Once installed globally, run `pok` from any project with `@pokit/core` installed:

```bash
cd my-project
pok              # Show interactive command menu
pok dev          # Run specific command
pok --help       # Show help
```

## Launcher commands

The launcher supplies two default commands:

```bash
pok init          # Create pok.config.ts
pok skill         # Print the pok agent skill to stdout
```

Project commands take precedence over these defaults. A command named `init` or
`skill`, or a command with either spelling as an alias, handles that invocation
instead.

## How It Works

The global `pok` command acts as a thin launcher that:

1. Imports `@pokit/core` from the current project
2. Calls `runCli()` to handle command routing
3. Shows helpful error messages if requirements aren't met

This approach ensures you always use the project's version of core, avoiding version mismatches.

## Requirements

- Bun >= 1.0.0
- `@pokit/core` installed in your project
