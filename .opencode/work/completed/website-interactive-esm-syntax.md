# Work Package: Update learn.ts to use ESM syntax

## Summary

The embedded `learn.ts` command in `useWebContainer.ts` uses CommonJS syntax (`require`, `exports.command`) while the rest of pok uses ESM syntax (`import`, `export`). This creates inconsistency in the tutorial examples shown to users.

## Context

- File: `packages/website-interactive/src/hooks/useWebContainer.ts`
- Lines: 152-519 (the embedded learn.ts content)
- The SPEC.md shows ESM syntax in examples
- The lesson markdown files (`lessons/*.md`) use ESM syntax
- The tabs setup section within learn.ts correctly uses ESM

## Current State

```javascript
const { defineCommand } = require('@openpok/core');
exports.command = defineCommand({ ... });
```

## Expected State

```typescript
import { defineCommand } from '@openpok/core';
export const command = defineCommand({ ... });
```

## Tasks

1. Update the embedded `learn.ts` in `useWebContainer.ts` to use ESM syntax
2. Update all code examples shown in lessons (Lesson 1, Lesson 2, Tabs) to use ESM
3. Update the generated hello.ts and greet.ts files to use ESM
4. Test that the WebContainer still executes the commands correctly with ESM

## Verification

- Run `pnpm dev` in packages/website-interactive
- Navigate through all lessons
- Verify code examples show ESM syntax
- Verify created files (hello.ts, greet.ts) use ESM syntax
- Verify `pok hello` and `pok greet` still work

## Output

**Status: Cannot be completed as specified**

### Investigation Findings

The CommonJS syntax in the WebContainer tutorial is **intentional and required**. The WebContainer runtime does not support ESM syntax.

Evidence from `vite.config.ts`:
- Line 51-52: `// Use CommonJS format because WebContainer's Node.js doesn't support ESM`
- Line 118: `// Use CommonJS (no "type": "module") for WebContainer compatibility`
- All bundles are built with `--format cjs` flag

### Verification

1. Attempted to convert learn.ts and code examples to ESM syntax
2. Browser testing showed error: "The requested module '@openpok/core' does not provide an export named 'defineCommand'"
3. Reverted changes back to CommonJS
4. Tutorial now works correctly

### Conclusion

The work package was based on incorrect assumptions. The apparent "inconsistency" between:
- Lesson markdown files (use ESM for documentation purposes)
- WebContainer code (uses CommonJS for runtime compatibility)

...is actually intentional. The markdown lessons show the "ideal" ESM syntax users would use in a real pok project, while the WebContainer must use CommonJS due to runtime limitations.

### Recommendations

1. **Keep the CommonJS syntax** in the WebContainer embedded code
2. **Consider adding a note** in the tutorial explaining that real pok projects use ESM, but the browser demo uses CommonJS for compatibility
3. Alternatively, **update lesson markdown files** to show CommonJS syntax to match the WebContainer demo (though ESM is preferred for documentation)
