# pok Conventions

## TypeScript

- ESM modules (`"type": "module"`)
- Strict mode enabled
- Zod v4 for all validation
- Use `as const` for immutable arrays
- Prefer inference over explicit types

## Naming

- Files: `kebab-case.ts`
- Commands: dot-notation for hierarchy (`db.migrate.ts` -> `mycli db migrate`)
- Types: PascalCase, prefix with `Infer` for inference helpers
- Functions: `defineX` pattern for declarative APIs

## Patterns

### defineX Functions

Use for declarative APIs:
- `defineCommand` - CLI commands
- `defineTask` - Reusable units of work
- `defineEnv` - Environment variable requirements
- `defineCheck` - Pre-flight checks

### Event-Driven Output

Commands emit events; adapters render. Core has zero TTY dependencies.

### Error Messages

Make them actionable with suggestions:
```typescript
throw new Error(`Command not found: ${name}. Did you mean: ${suggestions.join(', ')}?`);
```

## File Organization

```
packages/<name>/
  src/           # Source
  bin/           # CLI entry points
  test/          # Tests
  package.json
  tsconfig.json
```

## Testing

- Bun test runner
- Integration tests in `test/cases/`
- Test utilities in `test/utils/`
- Use `normalizeEvents` for event assertions

## Formatting

Prettier with:
- Single quotes
- Semicolons
- 2-space indent
- 100 char line width
- ES5 trailing commas

Run `pok format` before committing.
