# Support for NPM Scripts

## Goal

Enable users to run npm scripts defined in `package.json` as first-class commands within the `pok` CLI, configured explicitly.

## Scope

**In Scope**:

- Configuration mechanism to register specific npm scripts.
- Integration into `pok` command discovery (appearing in help menus).
- Execution via underlying package manager (npm, pnpm, yarn, bun).
- Streaming standard output directly to the terminal.

**Out of Scope**:

- Automatic discovery of all scripts in `package.json`.
- Capturing or reformatting script output.

## Hypothesis

Explicit configuration prevents CLI pollution and ensures only relevant developer tasks are exposed. Treating these as first-class commands simplifies the developer experience ("falling into the pit of success") by unifying tool invocation under `pok`.

## Approach

1.  Define schema for script registration (e.g., in `pok` config).
2.  Implement command loader to convert configured scripts into `pok` commands.
3.  Implement execution logic using `bun spawn` or `child_process`, delegating to the detected package manager.
4.  Ensure `stdio` is inherited/streamed.

## Validation

- [x] Configure a `pok` project with a mapping for a `build` script.
- [x] Verify `pok --help` lists the `build` command.
- [x] Run `pok build` and confirm it triggers the `package.json` script and shows output.
- [x] Forward arguments and flags (e.g. `pok test --watch`).

## Results

- **Implementation**: Updated `@pokit/config` with Zod schema for `npmScripts`. Updated `@pokit/core` with `getPackageManager` utility and dynamic command discovery in `buildCommandTree`.
- **Nesting**: Scripts containing `:` or `.` are automatically converted to nested command paths.
- **Argument Forwarding**: Implemented `ignoreUnknownFlags` in the argument parser to allow `pok` to act as a proxy.
- **Execution**: Commands are executed using the detected package manager (npm/pnpm/yarn/bun) with `r.exec(..., { interactive: true })`, ensuring full terminal inheritance.
- **Testing**: Added integration tests in `packages/core/test/npm-scripts.test.ts` covering argument forwarding and flag parsing.

## Evaluation

The hypothesis was proved correct. Explicitly exposing npm scripts as first-class commands provides a unified CLI experience without clutter. The addition of automatic nesting and transparent argument forwarding makes it feel like native `pok` commands.
