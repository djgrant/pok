 Task Env Contracts

## Goal/Problem

Tasks are coupled to both the resolver and the var selection via `defineEnv({ resolver, vars })`. A task knows *what* env vars it needs **and** *where* they come from. This means:

- Tasks aren't portable across projects (they import a specific resolver)
- Commands can't control how env vars are sourced
- The same task can't be reused with different resolvers

The env system should mirror the existing context pattern: resolvers declare `requiredContext`, commands provide context through flags, and the runner bridges the gap. Env vars should follow the same contractual split:

- **Tasks** declare what env vars they need (just names)
- **Commands** declare how env vars are resolved (the resolver binding)
- **Runner** checks satisfaction and bridges the two

## Scope

- `packages/core/src/lib/env.ts` — replace `defineEnv` with `defineEnvSpec` (vars-only contract)
- `packages/core/src/lib/task.ts` — task accepts `EnvSpec` instead of `Env`
- `packages/core/src/lib/command.ts` — add `env` binding to `defineCommand`
- `packages/core/src/lib/runner.ts` — resolve env from command binding, validate against task specs

## Design

### `defineEnvSpec` — task-side contract (vars only)

Tasks declare what they need without knowing where it comes from:

```ts
export type EnvSpec<TVars extends string = string> = {
  vars: readonly TVars[];
};

export function defineEnvSpec<const TVars extends string>(
  vars: readonly TVars[]
): EnvSpec<TVars> {
  return { vars };
}
```

Usage in tasks:

```ts
const dbEnv = defineEnvSpec(['POSTGRES_URL'] as const);

const migrate = defineTask({
  label: 'Run migrations',
  env: dbEnv,
  run: async (r, ctx) => {
    ctx.envs.POSTGRES_URL; // typed as string
  },
});
```

### Command-level env binding

Commands declare how env vars are resolved by binding resolver(s):

```ts
export const command = defineCommand({
  label: 'Deploy',
  context: {
    env: { from: 'flag', schema: z.enum(['dev', 'staging', 'prod']) },
  },
  env: {
    resolver: opResolver,     // or [staticResolver, opResolver] for fallback chains
    writer: opResolver,       // optional, for tasks that use envWriter
  },
  run: async (r) => {
    await r.run(migrate);     // runner checks opResolver can satisfy ['POSTGRES_URL']
  },
});
```

Multiple resolvers follow precedence order (first advertising a key wins) — same as `defineCompositeResolver` but declared at the command level.

### Runner changes

When executing a task:

1. Collect required keys from the task's `env` spec(s)
2. Validate that the command's bound resolver(s) advertise all required keys — throw with a clear error if not
3. Call resolver(s) to fetch values
4. Populate `ctx.envs` and the env cache

For `envWriter`:

1. Validate the command's `writer` exists and supports `write`
2. Validate the task's writer spec keys are in the writer's `availableVars`
3. Wire up `ctx.writeEnvs` to call `writer.write()`

### What happens to `defineEnv`

`defineEnv` currently bundles `{ resolver, vars }`. That bundle is split:

- **Task side:** `defineEnvSpec(vars)` — just the var names
- **Command side:** `env: { resolver }` on `defineCommand` — just the sourcing

`defineEnv` is removed. It was the coupling point.

### Type safety

The runner should be generic over available env vars so TypeScript enforces that tasks can only run if the command's resolver(s) advertise their required vars. The `Runner` type gains env var type parameters derived from the command's bound resolver:

```ts
interface Runner<TContext, TReadVars extends string, TWriteVars extends string> {
  run(task: /* constrained: task env vars ⊆ TReadVars */): DeferredTask;
}
```

`defineCommand` infers `TReadVars` from `env.resolver.availableVars` and threads it through to `RunFn`'s runner parameter.

## Approach

1. Add `EnvSpec` type and `defineEnvSpec` function
2. Update `defineTask` to accept `EnvSpec` (instead of `Env`) for both `env` and `envWriter`
3. Add `env` option to `defineCommand` config (`{ resolver, writer? }`)
4. Update runner to resolve env from command binding, validating against task specs
5. Update `Runner` type to carry env var type parameters
6. Remove `defineEnv`
7. Update tests and mocks

## Hypothesis

Splitting the env contract into task-side specs and command-side bindings will make tasks portable and give commands full control over env sourcing. The runtime change is small — the runner already calls `.resolve()` and `.parse()` — the main work is reorganising the type-level contracts.
