# Package Manager Integration (pmScripts & pmCommands)

## Goal
Rename `npmScripts` to `pmScripts` and add support for native package manager commands (`pmCommands`) with monorepo discovery.

## Scope
- `@pokit/core` configuration schema and router.
- `pokit` launcher protocol.
- Monorepo script and command discovery.
- Integration tests.
- Deprecation/aliasing of `npmScripts`.

## Hypothesis
Separating scripts and native commands into `pmScripts` and `pmCommands` will provide a cleaner, more intuitive DX for developers working in diverse package manager environments and monorepos. It also removes the "npm" specific naming in favor of "pm" (package manager).

## Approach
1. **Schema Update**: Update `PokConfigSchema` and `PokConfig` type in `packages/core/src/config/index.ts` to include `pmScripts` and `pmCommands`. Keep `npmScripts` as a deprecated alias.
2. **Protocol Update**: Update `LauncherSkeleton` in `packages/cmd/src/protocol.ts` to reflect the new naming and new property.
3. **Router Refactor**: 
    - In `packages/core/src/lib/router.ts`, rename `createNpmScriptCommand` to `createPmRunCommand`.
    - Implement `createPmCommand` for lifecycle commands (e.g., `install`, `add`).
    - Update `buildCommandTree` to process both lists.
    - Implement default built-ins list for `pmCommands: true`.
4. **CLI Bridge**: Update `packages/core/src/cli.ts` to pass the new config fields to the router.
5. **Test Migration**: 
    - Rename `packages/core/test/npm-scripts.test.ts` to `pm-integration.test.ts`.
    - Add test cases for `pmCommands` and monorepo command routing.

## Validation 
- `pok install` correctly invokes the detected package manager's install command.
- `pok <workspace> add <dep>` correctly invokes the command in the sub-package directory.
- Local `package.json` scripts correctly shadow `pmCommands` of the same name.
- `npmScripts` still works as a legacy alias.
- All integration tests pass.

## Results
- Implemented `pmScripts` and `pmCommands` in configuration schema and protocol.
- Refactored `router.ts` to support generic package manager commands and scripts.
- Added `pmCommands` support with default built-ins (`install`, `add`, `remove`, `update`, `audit`, `outdated`).
- Updated `npmScripts` to be a deprecated alias for `pmScripts`.
- Renamed and updated integration tests to `pm-integration.test.ts`.
- All tests passed, confirming:
    - `pmScripts` correctly loads and runs scripts from root and sub-packages.
    - `pmCommands` correctly runs native commands like `install` and `add`.
    - `npmScripts` legacy config still works.
    - Argument forwarding works as expected.

## Evaluation
The implementation successfully separates scripts from native commands, providing a more robust and cleaner configuration. The "pm" naming is more agnostic. The changes are backward compatible via the `npmScripts` alias. The approach of treating native commands as first-class citizens alongside scripts and file-based commands simplifies the user experience for common tasks.
