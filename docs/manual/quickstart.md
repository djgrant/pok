# Quick Start

This guide creates a pok CLI, defines one command, and runs it with both explicit flags and interactive prompts.

## Create a new project

```sh
bun create pokit my-cli
cd my-cli
bun install
```

## Or add pok to an existing project

```sh
bun add @pokit/core @pokit/terminal zod
pok init            # writes a zero-config pok.config.ts
```

`pok init` scaffolds:

```ts [pok.config.ts]
import { defineConfig } from '@pokit/core';

export default defineConfig({});
```

The launcher wires in `@pokit/terminal`'s reporter, prompter, and navigator
whenever they are omitted. In a plain `package.json` repo you can even skip the
config and let `pok` run in fallback mode.

## Define a command

```ts [commands/deploy.ts]
import { z } from "zod";
import { defineCommand } from "@pokit/core";

export const command = defineCommand({
  label: "Deploy to environment",
  context: {
    env: {
      from: "flag",
      schema: z.enum(["staging", "prod"]),
      description: "Target environment",
    },
  },
  run: async (r, ctx) => {
    await r.group("Deploy", { layout: "sequence" }, async (g) => {
      await g.activity("Build", () => r.exec("npm run build"));
      await g.activity("Push", () => r.exec(`deploy --env ${ctx.context.env}`));
    });
  },
});
```

## Run with a flag

```sh
$ pok deploy --env staging
```

## Run with interactive prompt

```sh
$ pok deploy
? Select environment > staging / prod
```

## Browse interactively

Run `pok` with no arguments to open the menu. Selecting a parent descends into
its submenu; pressing **Esc** in a submenu goes back up one level, and **Esc at
the root** exits.
