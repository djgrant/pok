# Replace version command with bumpp

## Problem

The current `commands/version.ts` is a simple wrapper around `pnpm exec npm version`. We want to replace it with `bumpp` which provides interactive prompts, git integration, and monorepo support.

## Scope

- `commands/version.ts`
- Root `package.json` (to add bumpp dependency)

## Approach

1. Research bumpp's API and CLI usage
2. Determine the simplest integration approach
3. If bumpp handles everything interactively, the command may just need minimal wrapper

## Hypothesis

Since bumpp doesn't export Zod schemas, the simplest approach is to either:
a) Call bumpp's CLI directly via exec (minimal wrapper)
b) Use bumpp's `versionBump()` function with basic options passed through

Key question: What's the minimum viable wrapper when the underlying tool already has good UX?

## Results

### Research Findings

**bumpp exports** (from `node_modules/bumpp/dist/index.d.ts`):

- `versionBump(options?: VersionBumpOptions)` - Main function, handles everything
- `defineConfig()` - For config file support (`bump.config.ts`)
- `VersionBumpOptions` - TypeScript interface (NOT Zod schema)

**Key VersionBumpOptions**:

- `release?: string` - "prompt" (default), "patch", "minor", "major", etc.
- `recursive?: boolean` - Bump all packages in monorepo (`-r` flag)
- `push?: boolean` - Push to remote (default: true)
- `commit?: boolean | string` - Commit message (default: true)
- `tag?: boolean | string` - Tag name (default: true)

**bumpp CLI flags** (from `bumpp --help`):

```
-r, --recursive     Bump package.json files recursively
-p, --push          Push to remote (default: true)
--no-push           Skip push
-y, --yes           Skip confirmation
--release <type>    Release type or version number
```

### Implementation Decision

Chose **Option B**: Use `versionBump()` function directly.

Rationale:

1. `versionBump()` already handles interactive prompts, git integration, and all UX
2. Calling `exec('bumpp')` would work but adds an extra process
3. Direct function call gives us programmatic control if needed later
4. No need for validation - bumpp validates its own inputs

### Code Changes

**commands/version.ts** - Replaced 47-line wrapper with 35-line minimal integration:

- Uses `versionBump()` from bumpp
- Exposes two flags: `-r` (recursive) and `--no-push`
- Passes first extra arg as release type (defaults to "prompt" for interactive)

**package.json** - Added `bumpp@^10.3.2` as dev dependency

## Evaluation

**Hypothesis confirmed**: The minimum viable wrapper is extremely thin.

Key learnings:

1. When a tool has good UX built-in, don't replicate it - just expose it
2. bumpp's interactive "prompt" mode handles version selection better than any wrapper could
3. The `-r` flag for monorepo support was the main value-add needed
4. No Zod schema needed - TypeScript interfaces are fine for internal options

The new command is simpler (35 vs 47 lines) while gaining:

- Interactive version prompts
- Automatic git commit/tag/push
- Monorepo recursive bumping
- Better UX overall
