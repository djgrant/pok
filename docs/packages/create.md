# @pokjs/create

Project scaffolding CLI for pok projects.

## Usage

```bash
bun create @pokjs/create my-project
```

Or with a specific directory:

```bash
bun create @pokjs/create ./path/to/project
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
    "@pokjs/core": "latest",
    "@pokjs/prompter-clack": "latest",
    "@pokjs/reporter-clack": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Example Command

```typescript
// commands/hello.ts
import { defineCommand } from '@pokjs/core';

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
   - `@pokjs/prompter-clack` (recommended)
   - `@pokjs/reporter-clack` (recommended)
   - `@pokjs/tabs-ink` (optional)

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
import { generatePackageJson, generateTsConfig, generateExampleCommand } from '@pokjs/create';

const pkg = generatePackageJson({
  name: 'my-cli',
  plugins: ['@pokjs/prompter-clack', '@pokjs/reporter-clack'],
});
```

## Related

- [Getting Started](../getting-started.md)
- [@pokjs/core](./core.md)
