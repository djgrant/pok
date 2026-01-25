# pok init Command

## Goal/Problem

When a user runs `pok` without a config file, they get an error. We need a `pok init` command to scaffold a basic `pok.config.ts` file.

## Scope

- `packages/cmd/bin/pok.ts` - handle `init` as a special command before config lookup
- `packages/cmd/src/init.ts` - new file for init logic

## Design

### Behavior

`pok init` should:

1. Check if `pok.config.ts` already exists (error if so)
2. Write a starter config file to cwd

### Generated Config

```ts
import { defineConfig } from 'pokit';

export default defineConfig({
  commandsDir: './commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
});
```

### Special Handling in cmd

`pok init` must work without an existing config file. The cmd wrapper should check for `init` argument before attempting config discovery.

## Approach

1. In `packages/cmd/bin/pok.ts`, check if `args[0] === 'init'` before config lookup
2. Create `packages/cmd/src/init.ts` with init logic
3. Generate config file with sensible defaults

## Hypothesis

A simple `pok init` command will provide a smooth onboarding experience when users first encounter the "no config found" error.

## Results

Implementation complete:

1. **Created `packages/cmd/src/init.ts`** - New module with `runInit()` function that:
   - Checks if `pok.config.ts` exists (exits with error if so)
   - Writes starter config template to cwd
   - Logs success message with next steps

2. **Updated `packages/cmd/bin/pok.ts`** - Added early intercept for `init` command:
   - Checks `args[0] === 'init'` before config discovery
   - Dynamically imports and runs `runInit()`
   - Exits cleanly after init completes

Tested both success and error paths manually.

## Evaluation

Implementation matches the work package specification exactly. The `pok init` command now provides a smooth onboarding path when users encounter the "no config found" error.
