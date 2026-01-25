## Plugin System & Sub-Apps

v3.0

### Goals

* Decouple **command definition** from **tree construction**.
* Enable modular “sub-apps”, external npm plugins, and runtime-generated command trees.
* Remove router “special cases” by **dogfooding** the mount system: the router builds the root tree by composing built-in mountables.

---

# 1) Core API & Types

We adopt **`MountableLike`** to allow lazy factories full access to context, and make `parentFile` optional to support the virtual root.

```ts
// packages/core/src/lib/mount.ts

import type { RouterConfig } from './router';
import type { CommandConfig, CommandTree } from './command';

export interface MountContext {
  // Global (read-only)
  routerConfig: RouterConfig;

  // Parent context
  /**
   * Absolute path to the file defining the parent command.
   * Undefined for the virtual root.
   */
  parentFile?: string;

  /** Path segments leading to this mount point (e.g. ['admin', 'users']) */
  parentPath: string[];

  /**
   * Effective configuration of the parent.
   * In a compose chain, this reflects updates made by previous plugins.
   */
  effectiveConfig: Readonly<CommandConfig>;

  /**
   * Children accumulated so far in a compose chain.
   * Plugins can inspect and augment/patch these.
   */
  currentChildren: CommandTree;
}

/**
 * Strategy for handling naming collisions with existing children.
 * - throw: Abort build (default).
 * - override: Replace existing child with new one.
 * - skip: Keep existing child, ignore new one (useful for "defaults").
 */
export type ChildConflictPolicy = 'throw' | 'override' | 'skip';

export interface MountResult {
  /** Subtree to attach/merge */
  children?: CommandTree;

  /** Config updates for parent (merged into effectiveConfig for next plugin) */
  config?: Partial<CommandConfig>;

  /** Collision handling policy for merging children (default: 'throw') */
  conflictPolicy?: ChildConflictPolicy;

  /**
   * Unique ID for cycle detection. Router interprets this as a “visited key”.
   *
   * Examples:
   * - Files: "dir:/abs/path/to/commands"
   * - Scripts: "pm-scripts:/abs/root?pattern=*"
   * - Static: "static:extra-commands"
   */
  mountSourceId?: string;
}

export interface Mountable {
  /** Optional label for debugging/errors */
  label?: string;
  mount(context: MountContext): Promise<MountResult>;
}

// Lazy factory with full context
export type MountableFactory = (context: MountContext) => Mountable | Promise<Mountable>;

// Input accepted by defineCommand
export type MountableLike = Mountable | MountableFactory;
```

Update `CommandConfig`:

```ts
// packages/core/src/lib/command.ts
import type { MountableLike } from './mount';

export type CommandConfig<C extends ContextDef = ContextDef> = {
  // ...existing props...
  mount?: MountableLike;
};
```

---

# 2) Core Logic: Composition & Merging

## 2.1 `noop()` Mountable

```ts
export const noop = (): Mountable => ({
  label: 'noop',
  async mount() {
    return {};
  },
});
```

## 2.2 `compose(...mountables: MountableLike[])`

### Semantics

* **Normalization:** If input is a function, call it with the current `MountContext` to obtain a `Mountable`.
* **Execution:** Strictly sequential, left-to-right.
* **Config merge:** Cumulative shallow merge. Later plugins override fields set by earlier plugins.
* **Children merge:** Merge by key with per-result `conflictPolicy` (`throw` default).
* **Fast-fail validation:** On each merge operation, validate:

  * **name collisions** (segment keys)
  * **alias collisions** at the same tree level (fast fail)
* **Provenance:** When inserting/replacing a child node, attach metadata immediately via `WeakMap`.

### Notes on determinism

* `compose` itself is deterministic; determinism of results depends on plugins returning stable `CommandTree` insertion order (e.g., `fromDirectory` sorts filenames).

---

# 3) Provenance & Metadata

Use an internal `WeakMap` keyed by the *final* `CommandNode` instance inserted into the tree.

```ts
type NodeMetadata = {
  sourceMountLabel?: string;
  sourceLocation?: string; // file path / dir path / package root
  createdFrom?: 'directory-scanner' | 'static' | 'pm-scripts' | 'pm-commands' | string;
};

const nodeMetadata = new WeakMap<import('./command').CommandNode, NodeMetadata>();
```

Whenever a node is inserted (or overridden), set metadata on the instance that ends up in the tree.

Use metadata for:

* Better error messages (collision/cycle diagnostics)
* Debugging tools later (e.g. “explain tree”)

---

# 4) Standard Plugins (Built-ins)

These live in `packages/core/src/plugins/*` and are exported from both:

* `@pokit/core` (core primitives + curated built-ins)
* `@pokit/core/plugins` (built-in mountables)

## 4.1 `fromDirectory(dir: string)`

**Behavior**

* Scans `*.{ts,tsx}` within `dir`.
* Ignores files starting with `_`.
* Converts filename to segments: `a.b.c.ts` → `['a','b','c']`
* Imports modules and looks for `export const command`.

**Determinism**

* Sort filenames alphabetically before importing/inserting.

**Cycle ID**

* `mountSourceId: "dir:" + resolvedAbsDir`

**Provenance**

* `createdFrom: 'directory-scanner'`
* `sourceLocation: resolvedAbsDir`
* `sourceMountLabel: mountable.label ?? 'fromDirectory'`

## 4.2 `mountFrom(baseUrl: string, relativePath: string)`

Helper wrapper around `fromDirectory`.

**Implementation**

* `new URL(relativePath, baseUrl)` + `fileURLToPath`
* Then call `fromDirectory(resolvedPath)`

**Docs**

* Requires ESM usage (expects `import.meta.url`). If CJS is supported, provide a documented shim or recommend `path.resolve(__dirname, ...)`.

## 4.3 `fromStatic(extra: Record<string, CommandConfig>)`

**Behavior**

* Turns an in-memory object into a `CommandTree`, splitting keys by dot:

  * `{ "db.seed": config }` → segments `['db','seed']`

**Cycle ID**

* `mountSourceId: "static:extra-commands"`

**Provenance**

* `createdFrom: 'static'`

## 4.4 `fromPackageScripts(pmScripts: RouterConfig['pmScripts'], projectRoot: string)`

**Critical requirement**

* Lift logic **verbatim** from current `router.ts` to avoid regression.

**Must preserve**

* workspace submenu detection (`parsePmCommand`, `resolveWorkspaceTarget`, workspace maps)
* argument forwarding inference (`--` suffix)
* `npm_config_recursive: undefined` environment unsetting
* filtering (skip `preinstall`)
* `ignoreUnknownFlags: true` and current behavior around args

**Cycle ID**

* Stable, human readable:

  * `pm-scripts:${absProjectRoot}?cfg=${stableStringify(pmScripts)}`

**Provenance**

* `createdFrom: 'pm-scripts'`

## 4.5 `fromPackageCommands(pmCommands: RouterConfig['pmCommands'], projectRoot: string)`

Same principle as scripts: migrate behavior exactly first, then refactor later.

**Cycle ID**

* `pm-commands:${absProjectRoot}?cfg=${stableStringify(pmCommands)}`

**Provenance**

* `createdFrom: 'pm-commands'`

---

# 5) Router Refactoring (Dogfooding)

## 5.1 Virtual Root

`buildCommandTree` constructs a virtual root context:

* `parentFile: undefined`
* `parentPath: []`
* `effectiveConfig: {}` (internal only)
* `currentChildren: new Map()`

## 5.2 Root Composition

```ts
const rootMountable = compose(
  config.pmScripts ? fromPackageScripts(config.pmScripts, config.projectRoot) : noop(),
  config.pmCommands ? fromPackageCommands(config.pmCommands, config.projectRoot) : noop(),
  config.extraCommands ? fromStatic(config.extraCommands) : noop(),
  fromDirectory(config.commandsDir)
);
```

`buildCommandTree` runs the root mountable, then recursively expands child nodes that themselves declare `mount`.

---

# 6) Recursive Expansion & Cycle Detection

## 6.1 Visited Set

* Router maintains `visitedIds: Set<string>` per recursion branch.
* Cycle detection uses `MountResult.mountSourceId` (generalized IDs, not only file paths).

## 6.2 Expansion algorithm (conceptual)

```ts
async function expandNode(
  node: import('./command').CommandNode,
  parentCtx: Omit<MountContext, 'effectiveConfig' | 'currentChildren'>,
  visited: Set<string>
): Promise<void> {
  const mountLike = node.config.mount;
  if (!mountLike) return;

  let effectiveConfig: CommandConfig = node.config;
  let currentChildren: CommandTree = node.children;

  const ctx: MountContext = {
    routerConfig: parentCtx.routerConfig,
    parentFile: parentCtx.parentFile,
    parentPath: parentCtx.parentPath,
    effectiveConfig,
    currentChildren,
  };

  const mountable = typeof mountLike === 'function' ? await mountLike(ctx) : mountLike;
  const result = await mountable.mount(ctx);

  if (result.mountSourceId) {
    if (visited.has(result.mountSourceId)) {
      throw new Error(`Cycle detected: ${result.mountSourceId}`);
    }
    visited.add(result.mountSourceId);
  }

  // Merge config updates into node.config (shallow)
  // Merge children into node.children (with conflict policy, alias fast-fail, provenance)

  for (const child of node.children.values()) {
    await expandNode(
      child,
      {
        routerConfig: parentCtx.routerConfig,
        parentFile: child.config?.file,
        parentPath: [...parentCtx.parentPath, child.segment],
      },
      new Set(visited)
    );
  }
}
```

---

# 7) Validation

## 7.1 Fast-fail validation (during merge)

* Detect duplicate segment names per conflict policy
* Detect alias conflicts at the same level

## 7.2 Global validation (post-build)

* Run existing `validateAliases(tree)` over the fully built tree

---

# 8) Stable Stringification (Internal Helper)

To ensure deterministic `mountSourceId` values (especially for PM plugins), introduce an internal helper:

```ts
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map(k => `${k}:${stableStringify(obj[k])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}
```

This ensures:

* Cycle IDs are stable across runs
* Debug output is predictable
* No accidental cycle misses due to key ordering

---

# 9) Exports

## Core primitives (stable)

From `@pokit/core`:

* `MountContext`, `MountResult`, `Mountable`, `MountableLike`
* `compose`, `noop`

## Built-ins (curated)

From `@pokit/core` and `@pokit/core/plugins`:

* `fromDirectory`
* `mountFrom`
* `fromStatic`
* `fromPackageScripts`
* `fromPackageCommands`

---

# 10) Implementation Tasks (Execution Order)

1. **Types**

   * Add `mount?: MountableLike` to `CommandConfig`
   * Implement `MountContext`, `MountResult`, `MountableLike` in `lib/mount.ts`

2. **Core Helpers**

   * Implement `noop`
   * Implement `compose`

3. **Provenance**

   * Add internal `WeakMap<CommandNode, NodeMetadata>`
   * Attach metadata on insert/override

4. **Plugins**

   * `fromDirectory` (sorted scanning)
   * `mountFrom` (URL resolution)
   * `fromStatic`

5. **Legacy Migration Plugins**

   * `fromPackageScripts` (verbatim logic)
   * `fromPackageCommands` (verbatim logic)

6. **Router Rewrite**

   * Replace hardcoded scanning with root composition
   * Implement recursive `expandNode`
   * Implement cycle detection via `mountSourceId`

7. **Validation**

   * Alias fast-fail during merge + global post-build validation

8. **Exports**

   * Export primitives + built-ins in `packages/core/src/index.ts`
   * Add `packages/core/src/plugins/index.ts` mapped to `@pokit/core/plugins`
