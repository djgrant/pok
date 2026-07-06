# Installation

## Prerequisites

- **Bun** >= 1.0.0 (https://bun.sh)
- **Node.js** >= 20 (for compatibility with some dependencies)

## Install the launcher

The `pok` command is a global launcher. Install it once:

```bash
bun add -g pokit
```

`pok` works in any repo with a `package.json` (fallback mode) or a `pok.config.ts`.
When a project ships its own local `pokit`, the global launcher delegates to it so
the project is served by the version it pinned.

## Create a new project

```bash
bun create pokit my-cli
cd my-cli
bun install
```

This scaffolds a `commands/` directory, a `package.json` pinning `@pokit/core`
and `@pokit/terminal`, and a `tsconfig.json`.

## Add to an existing project

```bash
# Core framework (required)
bun add @pokit/core zod

# Default terminal UI (interactive prompts, reporter output, menu navigation)
bun add @pokit/terminal
```

Then create a config:

```bash
pok init
```

which writes a zero-config `pok.config.ts`:

```typescript
import { defineConfig } from '@pokit/core';

export default defineConfig({});
```

When `reporter`, `prompter`, and `navigator` are omitted, the launcher wires in
`@pokit/terminal`'s defaults automatically. You can even skip `pok init`
entirely: in any repo with a `package.json`, running `pok` starts in fallback
mode and surfaces your `commands/` directory plus package scripts.

## Project structure

```
my-cli/
├── commands/           # Command files (file-based routing)
│   ├── dev.ts         # mycli dev
│   ├── build.ts       # mycli build
│   └── db.migrate.ts  # mycli db migrate
├── pok.config.ts       # Optional — omit for fallback mode
├── package.json
└── tsconfig.json
```

## Passing UI options

Only construct the UI yourself when you need options (e.g. `verbose`):

```typescript
import { defineConfig } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

export default defineConfig({
  appName: 'mycli',
  ...createTerminalUI({ verbose: true }),
});
```
