# @pokit/demo

Manual-testing playground for pok UI / Navigator work.

Unlike the repo root (which pins the **last published** pok via registry
aliases), this package links the pok packages with `workspace:*`, so it runs the
**current in-progress workspace code**. Use it to eyeball changes to the
terminal UI, reporter, prompter and Navigator.

## Run it

From this directory:

```sh
# 1. Globally-linked launcher (resolves @pokit/core + @pokit/terminal from
#    this package's workspace links)
cd demo && pok

# 2. Fallback: run the workspace launcher directly (no global install needed)
cd demo && bun ../packages/cmd/bin/pok.ts
```

Both discover `demo/pok.config.ts` and load the workspace packages.

## What's here

- `commands/hello.ts` - simplest command, no inputs
- `commands/greet.ts` - typed context/flags (`--name`, `--times`, `--loud`)
- `commands/deploy.ts` - dynamic, paged, async options select
- `commands/build.ts` - grouped tasks via `r.group` / `r.exec`
- `commands/env.ts` + `env.status.ts` + `env.reset.ts` - nested parent/child
  menu (exercises back-navigation)
- `package.json` scripts (`lint`, `typecheck`, `greet:all`) show up via
  `pmScripts: true`
