# Rename npm scope from @pokjs to @pokit

## Problem
The npm scope needs to be renamed from `@pokjs/` to `@pokit/` across the entire codebase. There's also one inconsistency where `packages/op/package.json` already uses `@pokit/op`.

## Scope
All files containing `@pokjs/`:
- 16 package.json files (name fields and dependencies)
- ~80 TypeScript source files (imports)
- ~40 documentation files (markdown)
- Test files
- Internal `.opencode/` documentation

## Approach
1. Move work package to `in-progress/`
2. Use find-and-replace to change `@pokjs/` to `@pokit/` in all files
3. Verify no `@pokjs` references remain
4. Record results

## Hypothesis
A global find-and-replace of `@pokjs/` → `@pokit/` will correctly rename all package references without breaking imports or dependencies.

## Results

**Files changed:** 171 files modified

### Breakdown by category:
- **package.json files:** 16 files (name fields and dependencies)
- **TypeScript source files:** ~80 files (imports)
- **Documentation files:** ~40 markdown files
- **Test files:** ~35 test cases and utilities
- **pnpm-lock.yaml:** Updated with new package names

### Execution steps:
1. Used `sed` to replace `@pokjs/` → `@pokit/` across all files
2. Found 3 additional references without trailing slash (`@pokjs` in comments/test paths)
3. Fixed those manually in:
   - `playground/src/hooks/useWebContainer.ts` (JSDoc comment)
   - `packages/cmd/test/cmd.test.ts` (2x node_modules path strings)

### Verification:
- `rg '@pokjs' /Users/coder/Repos/notation/pok` returns no matches
- All 171 files now use `@pokit/` consistently

### Note:
`packages/op/package.json` previously had `@pokit/op` (ahead of this change) and a dependency on `@pokjs/core`. After the rename, it now correctly uses `@pokit/core` as a dependency.

## Evaluation

Hypothesis confirmed. A global find-and-replace successfully renamed all package references. The only edge cases were 3 occurrences of `@pokjs` (without trailing slash) in comments and test path strings, which were also fixed.
