# Remove Legacy npmScripts

## Goal

Remove the `npmScripts` configuration option entirely, enforcing the use of `pmScripts`.

## Scope

- `packages/core/src/config/index.ts`: Remove `npmScripts` from `PokConfig` and schema.
- `packages/cmd/src/protocol.ts`: Remove `npmScripts` from `LauncherSkeleton`.
- `packages/core/src/lib/router.ts`: Remove fallback logic for `npmScripts`.
- `packages/core/test/pm-integration.test.ts`: Remove legacy compatibility tests.

## Hypothesis

Removing the deprecated alias immediately reduces technical debt and enforces the new naming convention ("pm" over "npm").

## Approach

1.  **Schema Update**: Remove `npmScripts` from `PokConfig` and `PokConfigSchema` in `packages/core/src/config/index.ts`.
2.  **Protocol Update**: Remove `npmScripts` from `LauncherSkeleton` in `packages/cmd/src/protocol.ts`.
3.  **Router Update**: Remove the `npmScripts` check in `packages/core/src/lib/router.ts`.
4.  **Test Update**: Remove the "works with legacy npmScripts" test case in `packages/core/test/pm-integration.test.ts`.

## Validation

- `bun test` passes.
- `npmScripts` in config causes a validation error (or is ignored/typed error).
- `pmScripts` continues to work.

## Results

- Successfully removed `npmScripts` from all configuration schemas and interfaces.
- Updated `packages/core/src/config/index.ts` to remove `npmScripts`.
- Updated `packages/cmd/src/protocol.ts` to remove `npmScripts`.
- Updated `packages/core/src/lib/router.ts` to remove fallback logic.
- Updated `packages/core/test/pm-integration.test.ts` to remove legacy test.
- Also updated `packages/core/src/cli.ts` and `packages/cmd/bin/pok.ts` to remove usage.
- Updated `pok.config.ts` to use `pmScripts`.
- Ran `bun test packages/core/test/pm-integration.test.ts` and verified all tests pass.

## Evaluation

The codebase is now cleaner and enforces the use of `pmScripts`. The legacy `npmScripts` alias is fully removed.
