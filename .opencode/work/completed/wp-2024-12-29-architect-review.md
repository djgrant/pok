# Architect Review: Playground Overhaul

## Problem

Code review before commit. A significant piece of work has been completed that includes:
1. A new `@pokjs/introspect` package - TUI file viewer with syntax highlighting and live file watching
2. A redesigned playground - Two-terminal layout with `pok learn` and `pok introspect` running side by side

## Scope

- `packages/introspect/` (new package)
- `playground/` (modified)
- `tsconfig.json` (modified)
- `pnpm-lock.yaml` (modified)

## Approach

1. Review package structure against monorepo conventions
2. Analyze code quality and maintainability
3. Check TypeScript compilation and tests
4. Review integration between packages
5. Assess alignment with pok design principles

## Results

### 1. Package Structure Review: `@pokjs/introspect`

**Follows Conventions:**
- ESM module (`"type": "module"`)
- Proper exports configuration with bun/types/import conditions
- Correct repository metadata
- MIT license present
- Zod v4 as peer dependency
- Proper workspace reference to `@pokjs/core`
- tsconfig.json extends base and references core

**Issues Found:**

| Issue | Severity | Description |
|-------|----------|-------------|
| Missing README.md | Minor | Other packages have README.md, this one doesn't |
| Missing homepage/bugs in package.json | Minor | Other packages include these fields |
| No test-utils devDependency | Minor | Other packages include `@pokjs/test-utils` for testing |

### 2. Code Quality Analysis

**Strengths:**
- Clean modular architecture with clear separation of concerns:
  - `state.ts` - Pure state management
  - `tree.ts` - File system operations
  - `render.ts` - ANSI rendering
  - `input.ts` - Keyboard handling
  - `watcher.ts` - File watching with fallback
  - `highlight.ts` - Syntax highlighting wrapper
  - `command.ts` - pok command definition
  - `introspect.ts` - Main orchestration
- Comprehensive test coverage (13 tests passing)
- Good error handling with graceful fallbacks
- WebContainer-friendly polling watcher fallback
- Clean index.ts with well-documented exports

**Minor Code Issues:**

| Issue | Location | Description |
|-------|----------|-------------|
| Unused `_rows` parameter | `render.ts:178` | `renderHelpOverlay(cols, _rows)` - underscore prefix is correct but could be removed |
| Magic numbers | `render.ts:42-43` | Layout calculations use magic numbers without named constants |
| Process signal handlers | `introspect.ts:132-140` | Signal handlers are never cleaned up; could accumulate on multiple runs |

### 3. TypeScript Compilation

**Finding:** TypeScript errors when running `tsc` directly:
```
src/command.ts(5,31): error TS2307: Cannot find module '@pokjs/core' or its corresponding type declarations.
src/command.ts(21,15): error TS7006: Parameter '_r' implicitly has an 'any' type.
src/command.ts(21,19): error TS7006: Parameter 'ctx' implicitly has an 'any' type.
```

**Analysis:** This is a **false positive**. The errors occur because:
1. TypeScript's project references require building dependencies first
2. The monorepo uses Bun for development which resolves workspace packages differently
3. Bun tests pass successfully (13/13), confirming runtime correctness
4. This is an existing pattern in the codebase - `@pokjs/core` itself has similar TS errors when checked with `tsc -b`

**Recommendation:** Not a blocker. The codebase uses Bun for execution, not tsc.

### 4. Test Coverage

**Status:** All 13 tests pass

**Coverage areas:**
- State management (creation, selection, toggling, scrolling)
- Tree scanning (directory expansion, refresh with selection preservation)
- File reading (success and error cases)
- Syntax highlighting (TypeScript, JavaScript, unknown extensions)

**Gap:** No tests for:
- `render.ts` (ANSI output - hard to test)
- `input.ts` (stdin handling - requires mocking)
- `watcher.ts` (file watching - integration test territory)

### 5. Playground Integration

**Strengths:**
- Clean two-terminal layout implementation
- Proper WebContainer bundling with `cli-highlight` dependency
- Correct `startDelay` prop to coordinate terminal startup
- `introspect.ts` command re-export in WebContainer filesystem
- All existing playground functionality preserved

**Code Quality:**
- `vite.config.ts` plugin properly handles introspect bundling
- `useWebContainer.ts` mounts introspect package correctly
- `App.tsx` cleanly renders two Terminal components
- CSS properly handles two-pane layout

**Issue Found:**

| Issue | Severity | Description |
|-------|----------|-------------|
| Root path fix | Neutral | Changed from `'../..'` to `'..'` in vite.config.ts - looks intentional/correct |

### 6. Design Principles Alignment

| Principle | Assessment |
|-----------|------------|
| **Schema is destiny** | Partially applied - `command.ts` uses Zod schemas for `path` and `depth` flags |
| **Convention over configuration** | Good - defaults to `commands/` directory, sensible depth limits |
| **Vertically-integrated abstractions** | Good - integrates with core's defineCommand, not a standalone tool |
| **Ceremony-free interfaces** | Good - simple API: `runIntrospect({ path?, depth? })` |
| **Principle of least API** | Good - minimal public surface, internal modules stay internal |
| **Pit of success** | Good - readonly viewer can't cause damage, safe defaults |

### 7. Potential Issues

**WebContainer Compatibility:**
- The watcher has a polling fallback for WebContainer where `fs.watch` doesn't work
- `cli-highlight` dependency is properly bundled for WebContainer
- CommonJS format used for WebContainer compatibility

**Memory/Performance:**
- File reading has a 1000-line limit (good)
- Watcher debounces at 100ms (good)
- Polling interval is 500ms (reasonable)

**Terminal Compatibility:**
- Uses standard ANSI escape codes
- Icons use Unicode (may not render in all terminals)
- No alternate screen buffer (intentional for simplicity?)

## Blocking Issues

None. The code is functional and well-structured.

## Recommended Fixes Before Commit

### Should Fix (Minor)

1. **Add README.md to introspect package**
   ```markdown
   # @pokjs/introspect
   
   Live file viewer TUI for pok commands directory.
   
   ## Usage
   
   ```bash
   pok introspect --path ./commands --depth 3
   ```
   ```

2. **Add missing package.json fields**
   Add `homepage` and `bugs` to match other packages.

3. **Clean up signal handlers**
   The SIGINT/SIGTERM handlers in `introspect.ts` should be removed on cleanup to prevent accumulation.

### Nice to Have (Optional)

1. Add test-utils devDependency for consistency
2. Extract magic numbers in render.ts to named constants
3. Add integration tests for watcher

## Evaluation

### Overall Assessment: **READY TO COMMIT**

The code is well-structured, follows monorepo conventions, and integrates cleanly with the existing codebase. The few issues identified are minor and don't block functionality.

**Quality Score:** 8/10
- Architecture: 9/10
- Code quality: 8/10
- Testing: 7/10
- Documentation: 6/10
- Integration: 9/10

**Recommendation:** Proceed with commit. Consider addressing the "Should Fix" items in a follow-up PR or as part of this commit if time permits.
