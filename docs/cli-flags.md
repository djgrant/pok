pok CLIs support several built-in flags that control behavior across all commands.

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

This is useful for:

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

## Flag Combinations

Flags can be combined:

```bash
# CI-friendly: no prompts, no unicode, no colors
mycli deploy --no-tty --no-unicode --no-color

# Debugging: full output with colors
mycli deploy --verbose
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

See [defineCommand](./api/define-command.md) for full details on defining command flags.

## Related

- [defineCommand](./api/define-command.md) - Command definition API
- [Shell Completion](./api/completion.md) - Tab completion for flags
- [Terminal Requirements](./terminal-requirements.md) - TTY compatibility
