# @pokit/config

Configuration types and utilities for pok.

## Installation

```bash
bun add @pokit/config
```

## Usage

```ts
import { defineConfig } from '@pokit/config'

export default defineConfig({
  commandsDir: './commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
})
```

## API

### `defineConfig(config: PokConfig): PokConfig`

Identity function for type inference in config files.

### `findConfigFile(startDir: string): { configPath: string; configDir: string } | null`

Search for a config file starting from the given directory, walking up the directory tree until found or reaching root.

### `validateConfig(config: unknown, configPath: string): PokConfig`

Validate required config fields and return clear error messages.

### `CONFIG_TEMPLATE`

Template string for scaffolding new pok.config.ts files.

### `PokConfig`

Configuration type with the following fields:

- `commandsDir` (required) - Directory containing command files
- `reporterAdapter` (required) - Reporter adapter package name
- `prompter` (required) - Prompter package name
- `projectRoot` (optional) - Project root for running shell commands
- `appName` (optional) - App name for CLI display
- `tabs` (optional) - Tabs adapter package name
- `version` (optional) - Version string for --version flag
