# Plugin System Vision

pok already feels good when your command tree is small: you drop files into `commands/`, each file exports a command, and the CLI discovers them.

The plugin system is about keeping that feeling as your CLI grows into a product: multiple teams, multiple domains, shared tooling, and commands that come from places other than a single folder.

## What It Should Feel Like (User Stories)

You should be able to build a CLI that feels cohesive for end developers, even if the implementation is split across repos, packages, and sources.

Imagine these day-to-day experiences:

1) "I install one package and new commands appear where I expect them."

I add an internal plugin (or an npm package) and it automatically mounts under `tools` or `platform` without me copying files around. When I run `pok tools`, I get a complete, browsable namespace that behaves like the rest of the CLI.

2) "I can carve out a sub-app without inventing a new framework."

My company has an `admin` area. I define one parent command (`admin`) and mount an entire subtree under it. Help text, grouping, and routing work the same as any other command.

3) "The CLI stays predictable, even when commands are generated."

Some commands are synthesized (package scripts, workspace packages, remote environments). Still: the same command names resolve the same way every time, collisions are obvious, and I don't get surprises based on import timing.

After that experience is locked in, the implementation becomes straightforward: make "where commands come from" a first-class concept.

## Mental Model: A Tree You Can Grow

Think of the CLI as a command tree.

- Every command is a node.
- A node can have children.
- A node can optionally declare a `mount` function that *produces* children.

"Mounting" is how the tree grows. Instead of hardcoding special cases in the router (directory scanning, package scripts, in-memory commands, etc.), we use one mechanism everywhere:

- The root is built by mounting one or more sources.
- Any command node can become a "sub-app" by mounting additional sources under itself.

A mount source can do anything that is reasonable for a CLI:

- load commands from a folder
- synthesize commands from config (workspace packages, scripts)
- read `package.json` or other metadata
- delegate to other mount sources

The important part is not *how* it loads, but that it plugs into the command tree the same way.

## Guarantees (Plain Language)

The plugin system is only a win if it stays boring and predictable. These are the guarantees we want to preserve:

- Determinism: given the same repo state + config, pok builds the same command tree. No "it depends on import order" behavior.
- Clear conflicts: if two sources try to claim the same path (for example, both define `admin.users`), pok fails fast with an error that points at both owners. No silent overrides.
- No infinite expansion: mounts cannot recurse forever. If mounting would create a cycle (A mounts B which mounts A, or a command mounts itself through aliases), pok detects it and errors.
- Stable namespaces: mounting under a parent means children names are scoped under that parent. A plugin cannot "leak" commands into unrelated namespaces unless you mount it there.

## Examples

### A command file today (works now)

This stays the baseline. Writing a command should not require knowing anything about plugins.

```ts
// commands/hello.ts
import { defineCommand } from '@pokit/core'

export const command = defineCommand({
  label: 'Hello',
  description: 'Print a greeting',
  run: async (r) => {
    r.log('Hello!')
  },
})
```

### A sub-app mounted under a parent command (planned)

You define a parent node, then mount a whole subtree under it. The mounted children show up as `admin.<child>`.

```ts
// commands/admin.ts (planned)
import { defineCommand } from '@pokit/core'
import { mountFrom } from '@pokit/core/plugins'

export const command = defineCommand({
  label: 'Admin',
  // Mounts ./admin/*.ts(x) under the admin namespace
  mount: mountFrom(import.meta.url, './admin'),
})
```

### The root becomes composition (planned)

Today, `packages/core/src/lib/router.ts` has explicit steps for multiple sources (package scripts, package-manager commands, `extraCommands`, directory scanning).

With mounting, the root is just a composition of mount sources in a fixed order. Conceptually:

```ts
// conceptual (planned)
const rootMountable = compose(
  config.pmScripts ? fromPackageScripts(config.pmScripts, config.projectRoot) : noop(),
  config.pmCommands ? fromPackageCommands(config.pmCommands, config.projectRoot) : noop(),
  config.extraCommands ? fromStatic(config.extraCommands) : noop(),
  fromDirectory(config.commandsDir)
)
```

That is the whole router story: mount, compose, expand.

## Non-goals

This system is intentionally narrow. It is not trying to:

- be a general-purpose task runner (pok already has tasks; plugins are about *command discovery and composition*)
- replace simple CLIs that can live entirely in one folder
- introduce a heavy "plugin manifest" format; plugins should feel like normal code

## Why This Improves Product/DX

For end developers, this turns "a pile of commands" into a product-shaped CLI:

- Teams can ship new capabilities as mounted sub-apps with stable namespaces.
- Large CLIs stay navigable because command trees are composed, not hand-wired.
- Generated commands (scripts, workspaces) behave like first-class commands, not router special cases.

For maintainers, it removes the endless router branching:

- One mechanism (mounting) replaces many ad-hoc sources.
- Plugins can be authored in-repo or published as npm packages.
- Fail-fast collisions and cycle detection keep the system safe as it grows.
