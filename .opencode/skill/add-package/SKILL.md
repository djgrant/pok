---
name: add-package
description: How to add a new package to the pok monorepo
---

# Adding a Package

pok is a pnpm monorepo. New packages go in `packages/`.

## Directory Structure

```
packages/<name>/
├── src/
│   └── index.ts       # Public exports
├── bin/               # CLI entry points (if applicable)
│   └── cli.ts
├── test/
│   └── <name>.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## package.json

```json
{
  "name": "@pokjs/<name>",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@pokjs/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

## tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

## Checklist

1. Create directory structure
2. Add `package.json` with workspace dependencies
3. Add `tsconfig.json` extending base config
4. Create `src/index.ts` with exports
5. Add to build command if needed (check `commands/build.ts`)
6. Run `pnpm install` to link workspace
7. Add basic tests in `test/`
8. Add `README.md` with package description

## Package Types

| Pattern   | Purpose                | TTY Dependencies   |
| --------- | ---------------------- | ------------------ |
| `core`    | Core framework         | None (UI-agnostic) |
| `*-clack` | Clack-based adapters   | Yes                |
| `tabs-*`  | Tab UI implementations | Yes                |
| `op`      | 1Password integration  | External CLI       |

## Workspace Dependencies

Use `workspace:*` for internal dependencies:

```json
{
  "dependencies": {
    "@pokjs/core": "workspace:*",
    "@pokjs/tabs-core": "workspace:*"
  }
}
```

## After Creating

```bash
pnpm install          # Link workspace
pok build             # Build all packages
pok test              # Verify tests pass
```
