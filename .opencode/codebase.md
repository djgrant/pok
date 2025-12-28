# Working in pok

## Verify Changes

Type check a specific package:
```bash
cd packages/<name> && npx tsc --noEmit
```

Format code:
```bash
pnpm prettier --write packages/<name>/src/
```

Run tests:
```bash
bun test packages/<name>/test/
```

## Monorepo

Each package is independent. Work within the package you're changing - don't build or test the whole repo unless asked.
