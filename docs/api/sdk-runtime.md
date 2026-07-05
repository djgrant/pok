# SDK Runtime (In-Process)

The SDK runtime executes a pok `CommandConfig` in process with an object-based context instead of a subprocess boundary.

Generated clients use this runtime through `generateSdk()` from `@pokit/sdk-gen` or `pok-sdk generate`, and you can also call it directly.

## Import

```ts
import { createSdkRuntime } from '@pokit/core';
import type { CommandReturn, CommandContextInput, OptionalizeUndefined } from '@pokit/core';
```

## createSdkRuntime

```ts
const runtime = createSdkRuntime({
  quiet: true,          // default true (runner.exec won't stream output)
  runPreChecks: true,   // default true (runs command.pre checks)
  validateOutput: true, // default true (validates command output if command.output exists)
});
```

### Options

- `reporterAdapter` (optional): defaults to `createRawReporterAdapter()`
- `prompter` (optional): defaults to `createRawPrompter({ strict: true })` so SDK calls never prompt
- `quiet` (optional, default `true`): controls runner output streaming for `r.exec(...)`
- `runPreChecks` (optional, default `true`): runs `command.pre`
- `validateOutput` (optional, default `true`): validates the value returned by `command.run(...)` against `command.output` when present

## runtime.invoke

```ts
const result = await runtime.invoke(command, {
  cwd: process.cwd(),
  context: { /* object context */ },
  args: ['--extra', 'positional', 'args'],
});
```

### Semantics (Non-Interactive)

- No prompting: missing required context values throw (same as CLI with `--no-tty`)
- Defaults are applied using the command’s Zod schemas (same defaulting behavior as CLI parsing)
- `pre` checks run (unless `runPreChecks: false`)
- If `command.output` exists and `validateOutput` is enabled, the returned value is validated before being returned

## Typing Helpers

- `CommandContextInput<typeof command>`: the input shape accepted by the command’s context schemas (uses `z.input`)
- `OptionalizeUndefined<T>`: makes `foo?: ...` for fields that can be `undefined`
- `CommandReturn<typeof command>`: `void` for commands without `output`, otherwise the typed structured output

Example:

```ts
type Ctx = OptionalizeUndefined<CommandContextInput<typeof command>>;
type Out = CommandReturn<typeof command>;
```

## Close

If you create a runtime, close it when you’re done (stops the reporter adapter):

```ts
runtime.close();
```
