# Introduction

pok is a file-based CLI framework for TypeScript. It builds a command tree from files, validates flags and context with Zod, executes commands and tasks through a shared runner, and routes terminal output through adapters.

```ts
// commands/deploy.ts
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

```sh
# Run with flag
$ mycli deploy --env staging

# Or interactively, pok prompts for missing values
$ mycli deploy
? Select environment > staging / prod
```

## Core model

1. **File-based routing**: commands are discovered from the filesystem with no registration layer.
2. **Typed context**: flags and context values are validated with Zod and inferred through the runner.
3. **Event-driven output**: commands emit semantic events and adapters render them.
4. **UI-agnostic core**: core stays free of terminal dependencies; the default UI (`@pokit/terminal`) is optional and wired in automatically.
5. **Zero-config**: `defineConfig({})` is enough — the `pok` launcher fills in the reporter, prompter, and navigator.

## Packages

| Package | Role |
| --- | --- |
| `@pokit/core` | Core framework with zero TTY dependencies |
| `@pokit/terminal` | Default terminal UI: reporter, prompter, navigator (clack) |
| `pokit` | Global `pok` launcher / trampoline |
| `create-pokit` | Project scaffolding CLI |
