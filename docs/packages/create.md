# create-pokit

`create-pokit` scaffolds a new pok CLI project with a commands directory, package manifest, TypeScript config, and the default UI dependency.

## Usage

```bash
bun create pokit my-project
```

An interactive prompt asks for a project name and a template.

## What It Creates

```
my-project/
├── commands/
│   ├── hello.ts       # Example command
│   └── build.ts       # Build command
├── package.json       # With pok dependencies
├── tsconfig.json      # TypeScript config
└── .gitignore
```

Commands are discovered from the `commands/` directory. The project runs through
the global `pok` launcher, which serves a repo with a `package.json` but no
`pok.config.ts` in **fallback mode** — so no config file or entry script is
scaffolded. Run `pok init` later to add a `pok.config.ts` when you want to
customize `appName`, `commandsDir`, or the UI surfaces.

### package.json

```json
{
  "name": "my-project",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "pok": "bun pok"
  },
  "dependencies": {
    "@pokit/core": "latest",
    "@pokit/terminal": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Example Command

```typescript
// commands/hello.ts
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    r.reporter.info('Hello from pok!');
  },
});
```

## Templates

The interactive setup offers:

- **Starter** (recommended) — `@pokit/core` + `@pokit/terminal`.
- **Minimal** — core only; add the UI later.
- **Full** — all plugins.
- **Custom** — pick plugins individually (currently `@pokit/terminal`).

## Post-Installation

```bash
cd my-project
bun install
pok            # Shows the interactive menu
pok hello      # Runs the hello command
```

## Programmatic Usage

```typescript
import { generatePackageJson, generateTsConfig, generateExampleCommand } from 'create-pokit';

const pkg = generatePackageJson({
  name: 'my-cli',
  plugins: ['@pokit/terminal'],
});
```
