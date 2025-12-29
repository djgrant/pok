---
name: write-tests
description: When adding a new feature, use this skill to write tests
---

## Orientation

- Bun test runner
- Integration tests in `test/cases/`
- Test utilities in `test/utils/`
- Unit tests in packages/{package}/test

## Test Utilities

Use the shared test utilities in `test/utils/`:
- `normalizeEvents` - Normalize events for assertions
- `createVirtualTerminal` - Mock terminal for testing
- Event assertion helpers

## Writing Tests

- Use Bun's test runner (`bun:test`)
- Follow existing patterns in `test/` and `packages/*/test/`

## Browser Testing

For browser-based testing, load the `browser` skill.
