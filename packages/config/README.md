# @pokit/config

Configuration types and utilities for pok.

## Installation

```bash
bun add @pokit/config
```

## Usage

```ts
import { defineConfig } from '@pokit/config'
import { createReporterAdapter } from '@pokit/reporter-clack'
import { createPrompter } from '@pokit/prompter-clack'

export default defineConfig({
  reporter: createReporterAdapter(),
  prompter: createPrompter(),
})
```

## API

### `defineConfig(config: PokConfig): PokConfig`

Identity function for type inference in config files.

### `findConfigFile(startDir: string): { configPath: string; configDir: string } | null`

Search for a config file starting from the given directory, walking up the directory tree until found or reaching root.

### `validateConfig(config: unknown, configPath: string): ResolvedPokConfig`

Validate required config fields and return clear error messages.

### `CONFIG_TEMPLATE`

Template string for scaffolding new pok.config.ts files.

### `PokConfig`

Configuration type with the following fields:

- `reporter` (required) - Instantiated reporter adapter
- `prompter` (required) - Instantiated prompter
- `commandsDir` (optional) - Directory containing command files (defaults to './commands')
- `appDir` (optional) - Root directory of the pok CLI app (defaults to '.')
- `cwd` (optional) - Working directory for running commands (defaults to '.')
- `appName` (optional) - App name for CLI display
- `tabs` (optional) - Instantiated tabs adapter
- `version` (optional) - Version string for --version flag

### Adapter Types

The package exports minimal structural types for adapters:

- `ReporterAdapter` - Contract for reporter adapters
- `Prompter` - Contract for prompter adapters  
- `TabsAdapter` - Contract for tabs adapters

Full behavioral contracts are defined in `@pokit/core`.
