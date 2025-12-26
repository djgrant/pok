# Shell Completion

pok supports shell completion for bash, zsh, and fish shells. Completion enables tab-completion for commands, subcommands, flags, and flag values.

## Installation

Generate and install the completion script for your shell:

### Bash

Add to your `~/.bashrc` or `~/.bash_profile`:

```bash
source <(mycli completion bash)
```

Then reload your shell:

```bash
source ~/.bashrc
```

### Zsh

Add to your `~/.zshrc`:

```bash
source <(mycli completion zsh)
```

Then reload your shell:

```bash
source ~/.zshrc
```

### Fish

Run once to install:

```bash
mycli completion fish > ~/.config/fish/completions/mycli.fish
```

## Usage

Once installed, press `Tab` to complete:

```bash
# Complete commands
mycli d<Tab>
# → deploy, dev, db

# Complete subcommands
mycli db <Tab>
# → migrate, seed, reset

# Complete flags
mycli deploy --<Tab>
# → --env, --dry-run, --help

# Complete flag values (for enums)
mycli deploy --env <Tab>
# → dev, staging, prod
```

## How It Works

pok uses a hidden `__complete` command to generate completions dynamically. When you press Tab, your shell calls:

```bash
mycli __complete <current-args>
```

The CLI returns matching completions based on:

1. **Commands** - Available commands at the current level
2. **Aliases** - Command aliases are included in completions
3. **Flags** - Context flags defined on the command
4. **Flag values** - Enum choices and boolean values

## Features

### Command Completions

Top-level and nested commands are completed:

```bash
mycli <Tab>          # Shows: build, deploy, db, dev
mycli db <Tab>       # Shows: migrate, seed, reset, all
```

### Alias Completions

Command aliases appear alongside command names:

```typescript
// commands/deploy.ts
export const command = defineCommand({
  label: 'Deploy to environment',
  aliases: ['d', 'dep'],
  // ...
});
```

```bash
mycli <Tab>  # Shows: deploy, d, dep, build, ...
```

### Flag Completions

Flags are completed when typing `--`:

```bash
mycli deploy --<Tab>  # Shows: --env, --dry-run, --verbose
```

### Flag Value Completions

For enum and boolean flags, possible values are suggested:

```typescript
context: {
  env: {
    from: 'flag',
    schema: z.enum(['dev', 'staging', 'prod']),
  },
  dryRun: {
    from: 'flag',
    schema: z.boolean().default(false),
  },
}
```

```bash
mycli deploy --env <Tab>      # Shows: dev, staging, prod
mycli deploy --dry-run <Tab>  # Shows: true, false
```

### Explicit Choices

You can provide explicit choices that override schema inference:

```typescript
context: {
  region: {
    from: 'flag',
    schema: z.string(),
    choices: ['us-east-1', 'us-west-2', 'eu-west-1'],
  },
}
```

## Detecting the Current Shell

pok can detect your shell from the `$SHELL` environment variable:

```typescript
import { detectShell } from '@openpok/core';

const shell = detectShell(); // 'bash' | 'zsh' | 'fish'
```

## Programmatic Script Generation

You can generate completion scripts programmatically:

```typescript
import { generateCompletionScript } from '@openpok/core';

const bashScript = generateCompletionScript('mycli', 'bash');
const zshScript = generateCompletionScript('mycli', 'zsh');
const fishScript = generateCompletionScript('mycli', 'fish');
```

## Troubleshooting

### Completions not working

1. Ensure the completion script is sourced in your shell config
2. Open a new terminal or reload your shell config
3. Verify with: `type _mycli_completions` (bash) or `which _mycli` (zsh)

### Stale completions

Completions are generated dynamically, so they always reflect the current command structure. If completions seem stale, try:

```bash
# Reload shell config
source ~/.bashrc  # or ~/.zshrc
```

### Fish completions not updating

For fish, regenerate the completions file:

```bash
mycli completion fish > ~/.config/fish/completions/mycli.fish
```

## Related

- [defineCommand](./define-command.md) - Command definition API
- [Commands](../concepts/commands.md) - Command concepts and patterns
