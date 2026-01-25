# Plugin System Implementation Notes (Non-Prescriptive)

This document distills `PLUGIN_PLAN.md` into:

- Invariants (must-haves)
- Options (deliberate choices)
- Notes (codebase reality + implementation sketches)
- Open questions

It is intentionally non-prescriptive: it aims to keep us honest about requirements without committing to specific implementations too early.

## Invariants

- Mounting is the single mechanism for building and modifying command subtrees.
- `CommandConfig` grows one new optional field: `mount?: MountableLike`.
- A mountable runs with a `MountContext` and returns a `MountResult`.
- Composition is sequential and deterministic (left-to-right), producing a single effective config + child tree.
- Config updates are merged shallowly (later updates override earlier ones).
- Children are merged by segment key with an explicit conflict policy (selected by the mount result).
- Collision handling fails fast during merge:
  - segment collisions (per the conflict policy)
  - alias collisions at the same tree level
  - keep the existing global alias validation pass after the full build: `validateAliases(tree)` in `packages/core/src/lib/router.ts`
- Cycle detection is explicit and plugin-driven via `MountResult.mountSourceId`.
- `mountSourceId` values must be deterministic.
  - If an ID incorporates config (notably `pmScripts`/`pmCommands`), it must use a stable stringification function named `stableStringify(...)` (key-sorted) to avoid non-deterministic object key order.
- Provenance is attached at insert/override time to the final `CommandNode` instance stored in the tree (so errors/debugging can explain where nodes came from).

- Built-in mountables list (names/intent):
  - `fromDirectory`
  - `mountFrom`
  - `fromStatic`
  - `fromPackageScripts`
  - `fromPackageCommands`

## What We Can Lift Verbatim (pmScripts / pmCommands)

Regression avoidance matters more than refactoring quality for the first extraction.

- `fromPackageScripts(...)` can start as a lift-and-shift of the current `pmScripts` behavior in `packages/core/src/lib/router.ts`.
  - Primary reference: `packages/core/src/lib/router.ts` (the `buildCommandTree` block labeled `// 1. Add package manager scripts (pmScripts)`).
  - Supporting helpers already in the file: `parsePmCommand(...)`, `resolveWorkspaceTarget(...)`, and the execution details in `createPmAction(...)`.
  - Specific behaviors worth preserving exactly:
    - workspace submenu detection (when a script points at a workspace and no explicit script is provided)
    - argument forwarding behavior (including the current ` --` suffix handling)
    - environment unsetting via `npm_config_recursive: undefined`
    - filtering (e.g. skipping `preinstall`)
    - `ignoreUnknownFlags: true` and current routing of args to pm

- `fromPackageCommands(...)` can start as a lift-and-shift of the current `pmCommands` behavior in `packages/core/src/lib/router.ts`.
  - Primary reference: `packages/core/src/lib/router.ts` (the `buildCommandTree` block labeled `// 2. Add native package manager commands`).
  - Preserve root command registration + workspace discovery via glob patterns.

## Options

- Mountable normalization: treat a function as a lazy factory (`(context) => Mountable | Promise<Mountable>`) vs treating it as an eager mountable.
- Conflict policy semantics: `'throw' | 'override' | 'skip'` (and whether any default is implied).
- Provenance storage: internal `WeakMap<CommandNode, NodeMetadata>` vs storing metadata directly on nodes.
- Cycle detection strategy: visited set per recursion branch vs a single global visited set.
- Determinism in directory scanning: whether `fromDirectory` sorts results before importing.
- Config merge depth: shallow merge only vs any form of deep merge (if supported, it should be explicit and tested).
- Exports surface:
  - whether built-in mountables are exported from `@pokit/core`, `@pokit/core/plugins`, or both
  - whether the built-ins are considered stable API or internal conveniences

## Notes

- Runtime is Bun and the command loader uses dynamic `import(filePath)` (see `packages/core/src/lib/router.ts`).
- Current router behavior that should remain stable while migrating to mountables:
  - file-based routing via `runtime.glob('*.{ts,tsx}', { cwd: commandsDir })` and skipping `_`-prefixed files
  - `extraCommands` insertion via dot-splitting keys
  - alias validation via `validateAliases(tree)`
  - command files continue to be able to `export const command = defineCommand(...)` with no new boilerplate

- Stable IDs: `PLUGIN_PLAN.md` calls out `stableStringify(...)` as the mechanism to produce deterministic `mountSourceId` values when IDs incorporate config.

### Notes: Possible Implementation Sequence (Non-Binding)

One reasonable order (not a commitment):

1. Add types (`MountContext`, `MountResult`, `MountableLike`) and `mount?: MountableLike`.
2. Add composition/merge helper(s) and wire in fast-fail collision checks.
3. Add provenance tracking.
4. Implement the built-in mountables (list in Invariants).
5. Dogfood in the router: root composition + recursive expansion + cycle detection.
6. Keep `validateAliases(tree)` as the final global pass.

## Open Questions

- Should mountables be allowed to remove children, or only add/override?
- What should be considered a "stable" `mountSourceId` contract (format, error reporting expectations, etc.)?
- Where should `stableStringify(...)` live (internal helper vs exported utility), and do we need to support non-JSON inputs?
- Do we need a public plugin registry mechanism, or is "import and mount" enough for v1?
- How should collision and cycle errors report provenance (file path vs package name vs mount label vs mountSourceId)?
- `mountFrom(import.meta.url, './dir')` is ESM-friendly; do we need a first-class CJS story?
