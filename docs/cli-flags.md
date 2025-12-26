# CLI Flags

pok CLIs support several built-in flags that control behavior across all commands.

## Help

Display help information for any command.

```bash
mycli --help
mycli -h
mycli deploy --help
```

When used at the root level, shows the main menu with all available commands. When used with a specific command, shows that command's usage, options, and description.

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

## Plain Mode

Disable interactive features and use simple output.

```bash
mycli deploy --plain
```

When `--plain` is enabled:

- No spinners or progress animations
- No interactive prompts (commands fail if required values are missing)
- No color output
- Simple line-by-line output

This is useful for:

- CI/CD environments
- Piping output to other tools
- Environments without TTY support
- Logging and debugging

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
- `--plain` mode is enabled

## Flag Combinations

Flags can be combined:

```bash
# CI-friendly: no prompts, no colors, verbose logging
mycli deploy --plain --verbose

# Debugging: full output with colors
mycli deploy --verbose
```

## Environment Variables

Some flags can also be set via environment variables:

| Flag         | Environment Variable |
| ------------ | -------------------- |
| `--no-color` | `NO_COLOR=1`         |
| `--plain`    | `POK_PLAIN=1`        |
| `--verbose`  | `POK_VERBOSE=1`      |

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

See [defineCommand](./api/define-command.md) for full details on defining command flags.

## Related

- [defineCommand](./api/define-command.md) - Command definition API
- [Shell Completion](./api/completion.md) - Tab completion for flags
- [Terminal Requirements](./terminal-requirements.md) - TTY compatibility
