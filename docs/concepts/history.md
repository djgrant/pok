# Command History & Replay

pok automatically records successful command executions, allowing you to quickly rerun them later. This is particularly useful for complex commands with many flags or interactive choices.

## How it Works

Whenever a command completes successfully, pok saves the command path and the arguments/flags used to a local history file. This history is scoped to your application name (`appName` in `pok.config.ts`).

### Recorded Data

- **Command Path**: The sequence of commands (e.g., `db`, `migrate`, `up`)
- **Arguments**: All positional arguments
- **Flags**: All flags provided via the CLI
- **Timestamp**: When the command was executed

## The `poks` Binary

The `poks` binary is a specialized tool for interacting with your command history. It provides an interactive menu to search and rerun recent commands.

### Usage

Run `poks` from your project root (where your `pok.config.ts` is located):

```bash
poks
```

This will open an interactive menu:

```
◆  Recent commands
│  ○ db migrate up --env staging
│  ● deploy --env prod --dry-run
│  ○ check all
│  ○ build
```

Selecting an entry will immediately execute that command using `pok`.

### Clearing History

You can clear the history for your application by using the `--clear` flag:

```bash
poks --clear
```

## Global Installation

For the best experience, it is recommended to have `pokit` (which includes both `pok` and `poks`) available in your path. If you are building a standalone CLI, your users will have access to these features automatically if you expose them.

## Implementation Details

History is stored in a standard OS-specific data directory (e.g., `~/Library/Application Support/pok/history/` on macOS).

- **Success Only**: Only commands that exit with code 0 are recorded.
- **De-duplication**: Identical consecutive commands are collapsed in the history.
- **Limit**: By default, the last 50 unique commands are preserved.

## Related

- [Commands](./commands.md)
- [CLI Flags](../cli-flags.md)
