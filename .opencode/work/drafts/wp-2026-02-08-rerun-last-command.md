# Command History & Rerun

## Goal/Problem

After running a command, there's no way to quickly rerun it. Users must retype the full command with all flags. A `poks` command could open an interactive history menu to select and rerun a previous command.

## Scope

- New: `packages/core/src/lib/history.ts` — read/write command history
- `packages/core/src/lib/router.ts` — persist command after successful execution
- `packages/cmd/bin/pok.ts` or new `packages/cmd/bin/poks.ts` — `poks` entry point
- `packages/cmd/package.json` — register `poks` binary

## Design

### `poks` command

A separate binary (`poks`) that opens an interactive history menu:

```
$ poks
? Recent commands
  db migrate --env staging
  deploy --env prod
  dev
  db seed --env dev
```

User selects a command, and it's re-executed with the stored args.

This should use the autocomplete/search-ahead prompt so users can filter history by typing.

### Storage

Use [`@folder/xdg`](https://github.com/folder/xdg) for cross-platform XDG-compliant paths.

Store at: `<xdg.data>/pok/<app-name>/history.json`

```json
{
  "entries": [
    {
      "commandPath": ["db", "migrate"],
      "args": ["--env", "staging"],
      "timestamp": "2026-02-08T12:00:00Z"
    },
    {
      "commandPath": ["deploy"],
      "args": ["--env", "prod"],
      "timestamp": "2026-02-07T15:30:00Z"
    }
  ]
}
```

Per-app scoping via `appName` from config so different pok projects don't collide.

### History management

- Cap at N entries (e.g. 50)
- Deduplicate: if the same command+args is run again, move it to the top rather than adding a duplicate
- Only persist on successful execution

### Persisting

After successful execution in `executeLeaf`, append the command path and original args to history.

### `poks` binary

`poks` needs to:
1. Find and load the `pok.config.ts` (same logic as `pok`)
2. Read history for that app
3. Show interactive menu with search-ahead
4. On selection, re-invoke `pok` with the stored args (or call `runCli` directly)

### Dependencies

Add `@folder/xdg` to `packages/core/package.json` (or `packages/cmd`).

## Approach

1. Add `@folder/xdg` dependency
2. Create `packages/core/src/lib/history.ts` with `appendHistory()`, `loadHistory()`, `pruneHistory()`
3. In `executeLeaf`, after successful execution, call `appendHistory()`
4. Create `poks` binary that loads config, reads history, shows autocomplete menu, and re-executes
5. Register `poks` in `packages/cmd/package.json` bin field

## Hypothesis

A dedicated `poks` command is more discoverable than a `--again` flag and supports browsing multiple past commands rather than just the last one. XDG-based storage keeps state out of the project directory.

## Open Questions

- Should `poks` show the full command string (e.g. `pok db migrate --env staging`) or just the subcommand + flags?
- Should history include commands that were selected from interactive menus, or only CLI-invoked commands?
- Should there be a `poks --clear` to wipe history?
