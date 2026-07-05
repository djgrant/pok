# Command History & Replay

pok records successful command executions in a local history file. The history stores the command path and resolved arguments so `poks` can list and rerun previous commands.

## Stored data

When a command completes successfully, pok writes the command path and the arguments or flags used to a history file scoped to the configured `appName`.

### Recorded Data

- **Command Path**: The sequence of commands (e.g., `db`, `migrate`, `up`)
- **Arguments**: All positional arguments
- **Flags**: All flags provided via the CLI
- **Timestamp**: When the command was executed

## The `poks` Binary

The `poks` binary reads that history file and opens an interactive picker for rerunning previous commands.

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

If `pokit` is on your path, both `pok` and `poks` are available. Standalone CLIs can expose the same flow by shipping both binaries.

## Implementation Details

History is stored in a standard OS-specific data directory (e.g., `~/Library/Application Support/pok/history/` on macOS).

- **Success Only**: Only commands that exit with code 0 are recorded.
- **De-duplication**: Identical consecutive commands are collapsed in the history.
- **Limit**: By default, the last 50 unique commands are preserved.
