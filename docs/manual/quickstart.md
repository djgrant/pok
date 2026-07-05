# Quick Start

This guide creates a pok CLI, defines one command, and runs it with both explicit flags and interactive prompts.

## Create a new project

```sh
pnpm create pokit my-cli
```

## Or add pok to an existing project

```sh
pnpm add @pokit/core
```

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
$ mycli deploy --env staging
```

## Run with interactive prompt

```sh
$ mycli deploy
? Select environment > staging / prod
```
