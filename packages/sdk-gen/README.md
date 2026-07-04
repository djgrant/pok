# @pokit/sdk-gen

Generate a typed, in-process TypeScript client from a pok command tree.

The generated SDK mirrors your CLI command tree as nested methods (for example `client.db.migrate(...)`), and executes commands **in-process** via `createSdkRuntime()` (no subprocess).

## Install

```bash
pnpm add -D @pokit/sdk-gen
```

## Generate Programmatically

```ts
import { generateSdk } from '@pokit/sdk-gen';

const result = await generateSdk({
  config: './pok.config.ts',
  out: './pok.sdk.gen.ts',
  includePm: false,
});

console.log(result.outPath);
```

By default, this API:

- discovers `pok.config.ts` by walking up from `process.cwd()`
- writes `./pok.sdk.gen.ts` relative to the config directory
- **does not include** package-manager commands (`pmScripts` / `pmCommands`)

### Options

- `config`: a `pok.config.ts` file path or a directory containing one
- `out`: output TS file (default `./pok.sdk.gen.ts` relative to config dir)
- `importExtension`: control generated import specifiers (`preserve` | `ts` | `js`, default `preserve`)
- `includePm`: include pm-generated commands (default `false`)
- `cwd`: working directory used for config discovery and relative paths (default `process.cwd()`)

## CLI

```bash
pok-sdk generate
```

CLI flags map directly to the same programmatic options:

- `--config <path>`
- `--out <path>`
- `--import-extension <preserve|ts|js>`
- `--include-pm <true|false>`

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

- [Full documentation](https://github.com/djgrant/pok/blob/main/docs/packages/sdk-gen.md)
- [@pokit/core](https://github.com/djgrant/pok/blob/main/docs/packages/core.md)
