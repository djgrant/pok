# create-pokit

`create-pokit` scaffolds a new pok CLI project with a commands directory, entry point, package manifest, and default adapter dependencies.

## Usage

```bash
bun create pokit my-project
```

Or with a specific directory:

```bash
bun create pokit ./path/to/project
```

## What It Creates

```
my-project/
├── commands/
│   ├── hello.ts       # Example command
│   └── build.ts       # Build command
├── pok                # CLI entry point
├── package.json       # With pok dependencies
├── tsconfig.json      # TypeScript config
└── .gitignore
```

### package.json

```json
{
  "name": "my-project",
  "type": "module",
  "scripts": {
    "pok": "bun pok"
  },
  "dependencies": {
    "@pokit/core": "latest",
    "@pokit/prompter-clack": "latest",
    "@pokit/reporter-clack": "latest"
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

## Interactive Setup

The create CLI prompts for:

1. **Project name** - Used in package.json
2. **Plugins** - Which adapters to include:
   - `@pokit/prompter-clack` (recommended)
   - `@pokit/reporter-clack` (recommended)
   - `@pokit/opentui` (optional)

## Post-Installation

After creation:

```bash
cd my-project
bun install
bun pok        # Shows interactive menu
bun pok hello  # Runs hello command
```

## Programmatic Usage

```typescript
import { generatePackageJson, generateTsConfig, generateExampleCommand } from 'create-pokit';

const pkg = generatePackageJson({
  name: 'my-cli',
  plugins: ['@pokit/prompter-clack', '@pokit/reporter-clack'],
});
```
