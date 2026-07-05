# Global Flags

pok exposes built-in global flags that control help output, terminal behavior, formatting, and command history.

## Help

Display help information for any command.

```bash
mycli --help
mycli -h
mycli deploy --help
```

When used at the root level, shows the root help with all available commands. When used with a specific command, shows that command's usage, options, and description.

### Help Output

```
$ mycli deploy --help
Deploy to environment

Usage: mycli deploy [options]

Aliases: d, dep

Options:
  --env <value>     Target environment (dev, staging, prod)
  --dry-run         Simulate without making changes
  --help            Show help
```

## Version

Display the CLI version.

```bash
mycli --version
```

Shows the version from your `package.json`.

## No TTY

Disable interactive UI (menus, prompts, spinners).

```bash
mycli --no-tty
```

When `--no-tty` is enabled:

- No interactive menus or prompts
- Missing required flags fail with helpful errors
- Root invocation (`mycli`) prints help instead of opening the menu

Use `--no-tty` when the command runs in:

- CI/CD environments
- Piping output to other tools
- Environments without TTY support
- Automation scripts

`CI` and `NO_TTY=1` are treated as `--no-tty`.

## No Unicode

Disable Unicode symbols and use ASCII fallbacks.

```bash
mycli deploy --no-unicode
```

When `--no-unicode` is enabled:

- Unicode symbols are replaced with ASCII fallbacks
- Color and interactivity are unaffected

## Verbose Mode

Enable verbose output for debugging.

```bash
mycli deploy --verbose
```

When `--verbose` is enabled:

- Shows detailed execution information
- Displays full command output (not truncated)
- Includes timing information
- Shows environment variable resolution

## No Color

Disable colored output.

```bash
mycli deploy --no-color
```

Strips ANSI color codes from all output. This is automatically enabled when:

- `NO_COLOR` environment variable is set
- Output is not a TTY (e.g., piped to a file)

## Format

Specify the output format for commands with structured output.

```bash
mycli list --format json
mycli list --format table
mycli list --format csv
```

When a command defines an `output` schema, the `--format` flag controls how the data is rendered:

- **No flag**: Calls the command's `format()` function for human-readable display
- **`--format json`**: Outputs `JSON.stringify(data)` to stdout
- **`--format table`**: Table format (falls back to JSON currently)
- **`--format csv`**: CSV format (falls back to JSON currently)

This enables piping structured data to other tools:

```bash
mycli list --format json | jq '.tasks[] | .id'
```

Only applies to commands that define an `output` schema. Commands without output are unaffected.

## Flag Combinations

Flags can be combined:

```bash
# CI-friendly: no prompts, no unicode, no colors
mycli deploy --no-tty --no-unicode --no-color

# Debugging: full output with colors
mycli deploy --verbose

# Machine-readable: structured JSON output
mycli list --format json --no-tty
```

## Environment Variables

Some flags can also be set via environment variables:

| Flag           | Environment Variable |
| -------------- | -------------------- |
| `--no-color`   | `NO_COLOR=1`         |
| `--no-unicode` | `NO_UNICODE=1`       |
| `--no-tty`     | `NO_TTY=1`           |

Environment variables are overridden by explicit flags.

## Command-Specific Flags

In addition to these global flags, each command can define its own flags via the `context` property:

```typescript
export const command = defineCommand({
  label: 'Deploy',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']),
      description: 'Target environment',
    },
    dryRun: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Simulate without making changes',
    },
  },
  run: async (r, ctx) => {
    // ctx.context.env, ctx.context.dryRun
  },
});
```

Flags can also define a `resolve` function to load interactive options (including pagination).

See [defineCommand](./api/define-command.md) for full details on defining command flags.

## The `poks` Binary

In addition to the main `pok` binary, the `poks` binary is provided to help you quickly rerun commands from your history.

```bash
# Open interactive history menu
poks

# Clear command history
poks --clear
```

See [Command History](./concepts/history.md) for more details.
