# pok Config File

## Goal/Problem

pok currently uses convention-based discovery with hardcoded paths (`commands/` or `cli/commands/`). As a global CLI, there's no way to:

- Customize the commands directory location
- Configure adapters (reporter, prompter, tabs)
- Set project-level defaults (app name, version)

This limits flexibility for projects with non-standard structures, especially monorepos where the pok app lives in a subdirectory.

## Scope

- `packages/cmd/bin/pok.ts` - config discovery and loading
- `packages/cmd/src/config.ts` - new file for config types and `defineConfig`
- `packages/core/src/cli.ts` - simplify `runCli()` to accept resolved config

## Design

### Config File Locations

`cmd` searches for config in order (first found wins):

1. `pok.config.ts` in cwd
2. `.config/pok.config.ts` in cwd
3. Walk up parent directories, repeat search at each level
4. Stop at filesystem root

If no config found: **hard error** directing user to run `pok init`.

### Config Schema

```ts
// packages/cmd/src/config.ts
export type PokConfig = {
  /** Directory containing command files - REQUIRED */
  commandsDir: string;

  /** Project root for running shell commands */
  projectRoot?: string;

  /** App name for CLI display */
  appName?: string;

  /** Reporter adapter package name, e.g. '@pokit/reporter-clack' */
  reporterAdapter: string;

  /** Prompter package name, e.g. '@pokit/prompter-clack' */
  prompter: string;

  /** Tabs adapter package name, e.g. '@pokit/tabs-ink' */
  tabs?: string;

  /** Version string for --version flag */
  version?: string;
};

/** Identity function for type inference */
export function defineConfig(config: PokConfig): PokConfig {
  return config;
}
```

### Required Fields

- `commandsDir` - no fallback, must be explicit
- `reporterAdapter` - no fallback to `@pokit/reporter-clack`
- `prompter` - no fallback to `@pokit/prompter-clack`

### Path Resolution

- `commandsDir` is relative to the config file location
- `projectRoot` is relative to the config file location (defaults to config file directory)

### Example Config

```ts
// pok.config.ts
import { defineConfig } from 'pokit';

export default defineConfig({
  commandsDir: './cli/commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
});
```

### cmd Wrapper Behavior

1. Walk up from cwd looking for config file
2. Import the config (Bun handles TS natively)
3. Resolve `@pokit/core` from the directory where config was found
4. Resolve paths relative to config file location
5. Dynamically import adapters
6. Call `runCli()` with resolved config

### Error Messages

No config found:

```
Error: No pok configuration found.

Run `pok init` to create a pok.config.ts file.
```

Missing required field:

```
Error: commandsDir is required in pok.config.ts
```

## Approach

1. Add `defineConfig` and types to `packages/cmd/src/config.ts`
2. Update `packages/cmd/bin/pok.ts` to:
   - Search for config file (walk up directories)
   - Load and validate config
   - Resolve paths relative to config location
   - Dynamically import adapters
   - Call `runCli()` with resolved config
3. Simplify `packages/core/src/cli.ts`:
   - Remove convention-based discovery
   - Accept already-resolved config
4. Export `defineConfig` from `pokit` package

## Hypothesis

A required config file with explicit adapter configuration will:

- Eliminate magic/hidden behavior
- Support monorepo structures cleanly
- Make dependencies explicit and discoverable
- Simplify the core package

## Results

### Files Created

- `packages/cmd/src/config.ts` - PokConfig type and defineConfig function
- `pok.config.ts` - Config file for the pok monorepo itself

### Files Modified

- `packages/cmd/bin/pok.ts` - Complete rewrite for config discovery and loading
- `packages/cmd/package.json` - Added exports for config module, updated files array
- `packages/cmd/tsconfig.json` - Added src directory to include
- `packages/cmd/test/cmd.test.ts` - Updated tests for new config-based behavior
- `packages/core/src/cli.ts` - Simplified to accept pre-resolved config (RunCliConfig)
- `packages/core/src/index.ts` - Added RunCliConfig type export
- `packages/core/bin/pok.ts` - Deprecated in favor of global pokit CLI

### Implementation Details

1. **Config Discovery**: The `cmd` binary now searches for `pok.config.ts` or `.config/pok.config.ts` starting from cwd, walking up the directory tree until found or reaching filesystem root.

2. **Config Validation**: Required fields (commandsDir, reporterAdapter, prompter) are validated with clear error messages showing example configuration.

3. **Path Resolution**: Paths are resolved relative to the directory where the config file was found, not cwd.

4. **Adapter Resolution**: Adapters are dynamically imported using `Bun.resolve()` from the config directory, ensuring the project's installed versions are used.

5. **Core Simplification**: `runCli()` now accepts a `RunCliConfig` object with pre-instantiated adapters, removing all discovery logic from core.

6. **Deprecated Core Binary**: The `packages/core/bin/pok.ts` binary now shows a deprecation error directing users to use the global `pokit` CLI.

### Test Results

- All 4 cmd package tests pass
- TypeScript type checking passes

## Evaluation

The implementation successfully:

- Eliminates convention-based discovery in favor of explicit configuration
- Supports monorepo structures (paths relative to config file)
- Makes adapter dependencies explicit and discoverable
- Provides clear, actionable error messages
- Maintains backwards compatibility through clear migration path (error message suggests `pok init`)
