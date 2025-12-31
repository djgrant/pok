# Contributing to pok

## Development Setup

```bash
git clone https://github.com/notation-dev/openpok.git
cd openpok
pnpm install
```

## Commands

```bash
pok dev          # Run in development mode
pok build        # Build all packages
pok test         # Run tests
pok check        # Run checks (types, format, lint)
```

## Package Structure

| Package | Name | Description |
|---------|------|-------------|
| `packages/core` | `@pokit/core` | Core framework |
| `packages/cmd` | `pokit` | Global CLI launcher |
| `packages/create` | `create-pokit` | Project scaffolding |
| `packages/op` | `@pokit/op` | Operation utilities |
| `packages/prompter-clack` | `@pokit/prompter-clack` | Interactive prompts |
| `packages/reporter-clack` | `@pokit/reporter-clack` | Terminal output |
| `packages/reporter-web` | `@pokit/reporter-web` | Web reporter |
| `packages/tabs-core` | `@pokit/tabs-core` | Shared tabs logic |
| `packages/tabs-ink` | `@pokit/tabs-ink` | Tabbed UI (Ink) |
| `packages/tabs-opentui` | `@pokit/tabs-opentui` | Tabbed UI (OpenTUI) |

## Versioning Strategy

Packages are split into two groups with different versioning:

### Scoped packages (`@pokit/*`)

All scoped packages share a unified version number and are released together:

- `@pokit/core`
- `@pokit/op`
- `@pokit/prompter-clack`
- `@pokit/reporter-clack`
- `@pokit/reporter-web`
- `@pokit/tabs-core`
- `@pokit/tabs-ink`
- `@pokit/tabs-opentui`

### Unscoped packages

Unscoped packages are versioned independently since they change less frequently:

- `pokit` - Thin CLI wrapper, rarely needs updates
- `create-pokit` - Scaffolding tool, updates only when templates change

## Release Process

### Prerequisites

```bash
npm login
```

### Release scoped packages (default)

```bash
pok version          # Bump version, commit, tag, push
pok build            # Build all packages
pok publish          # Publish to npm

# Or dry-run first
pok publish --dry-run
```

### Release unscoped packages

Only needed when `pokit` or `create-pokit` change:

```bash
pok version --unscoped-only
pok publish --unscoped-only
```

## Testing

```bash
pok test             # Run all tests
bun test             # Run tests directly
```

Tests are located in `packages/*/test/` directories.

## Code Style

- ESM modules (`"type": "module"`)
- TypeScript strict mode
- Zod v4 for validation
- Prefer type inference over explicit types
