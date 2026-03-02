# @pokit/sdk-gen

Generate a typed, in-process TypeScript client from a pok command tree.

The generated SDK mirrors your CLI command tree as nested methods (for example `client.db.migrate(...)`), and executes commands **in-process** via `createSdkRuntime()` (no subprocess).

## Install

```bash
pnpm add -D @pokit/sdk-gen
```

## Generate

```bash
pok-sdk generate
```

By default, this:

- discovers `pok.config.ts` by walking up from `process.cwd()`
- writes `./pok.sdk.gen.ts` relative to the config directory
- **does not include** package-manager commands (`pmScripts` / `pmCommands`)

### Flags

- `--config <path>`: a `pok.config.ts` file path or a directory containing one
- `--out <path>`: output TS file (default `./pok.sdk.gen.ts` relative to config dir)
- `--import-extension <preserve|ts|js>`: control generated import specifiers (default `preserve`)
- `--include-pm <true|false>`: include pm-generated commands (default `false`)

## Use The Generated SDK

```ts
import { createClient } from './pok.sdk.gen';

const client = createClient();

const result = await client.hello({ name: 'world' });
console.log(result);

client.close();
```

## Notes

- The generator emits typed methods for commands that come from real command modules (file-based commands and mounted sub-app commands).
- If you enable `--include-pm true`, pm-generated commands are callable but untyped.

## Related

- [SDK Runtime](../api/sdk-runtime.md)
- [@pokit/core](./core.md)

