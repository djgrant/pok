Task Env Contracts

## Goal/Problem

Tasks are coupled to both the resolver and the var selection via `defineEnv({ resolver, vars })`. A task knows _what_ env vars it needs **and** _where_ they come from. This means:

- Tasks aren't portable across projects (they import a specific resolver)
- Commands can't control how env vars are sourced
- The same task can't be reused with different resolvers

The env system should separate the **contract** (what vars a task needs) from the **fulfilment** (which resolver provides them), while keeping binding close to where domain knowledge lives.

## Scope

- `packages/core/src/lib/env.ts` — add `defineEnvSpec`, add `.using()` method on specs
- `packages/core/src/lib/task.ts` — task accepts `EnvSpec` (unfulfilled) or `FulfilledEnvSpec` (via `.using()`)
- `packages/core/src/lib/runner.ts` — resolve env from fulfilled specs, require env at call site for unfulfilled specs
- `packages/core/src/lib/command.ts` — no env changes needed (commands stay out of env business)

## Design

### `defineEnvSpec` — vars-only contract

Tasks declare what they need without knowing where it comes from:

```ts
export type EnvSpec<TVars extends string = string> = {
  vars: readonly TVars[];
  using<TEnv extends Env>(env: TEnv): FulfilledEnvSpec<TVars, TEnv>;
};

export type FulfilledEnvSpec<TVars extends string = string, TEnv extends Env = Env> = {
  vars: readonly TVars[];
  env: TEnv;
};

export function defineEnvSpec<const TVars extends string>(vars: readonly TVars[]): EnvSpec<TVars> {
  return {
    vars,
    using(env) {
      // Validate: env.resolver.availableVars ⊇ vars
      return { vars, env };
    },
  };
}
```

### Spec-side binding via `.using()`

Instead of binding the resolver at the command, the spec is fulfilled either at task definition or at the call site.

#### Case 1: Self-contained task (common case)

The task knows its env — binding happens at definition time:

```ts
const dbSpec = defineEnvSpec(['POSTGRES_URL'] as const);

const migrate = defineTask({
  label: 'Run migrations',
  env: dbSpec.using(dbaEnv), // fulfilled at definition
  run: async (r, ctx) => {
    ctx.envs.POSTGRES_URL; // typed from spec
  },
});
```

#### Case 2: Portable task (env deferred to caller)

The task declares what it needs but the caller provides fulfilment:

```ts
const migrate = defineTask({
  label: 'Run migrations',
  env: dbSpec, // unfulfilled spec
  run: async (r, ctx) => {
    ctx.envs.POSTGRES_URL; // still typed from spec
  },
});

// Command fulfils at call site:
await r.run(migrate, { env: dbaEnv }); // TypeScript enforces this
```

`r.run()` requires an `env` argument when the spec is unfulfilled — this is a compile error if omitted.

#### Case 3: Heterogeneous env in a single command

This is the case that command-level binding cannot handle cleanly:

```ts
export const command = defineCommand({
  label: 'Deploy',
  context: {
    env: { from: 'flag', schema: z.enum(['dev', 'staging', 'prod']) },
  },
  run: async (r) => {
    // Each task has its own resolver chain with intentional precedence
    await r.run(buildAssets); // env: viteBuildSpec.using(viteEnv)
    await r.run(deployWorker); // env: cloudflareSpec.using(cfEnv)
    await r.run(rotateSecrets); // env: edgeSecretsSpec.using(vaultEnv)
  },
});
```

No mega-composite. No risk of dev values leaking into prod resolver chains.

### Writer support

The same pattern works for `envWriter`:

```ts
// Self-contained writer task
const bootstrap = defineTask({
  label: 'Bootstrap secrets',
  envWriter: bootstrapSpec.using(bootstrapEnv),
  run: async (r, ctx) => {
    await ctx.writeEnvs({ POSTGRES_URL: '...' });
  },
});

// Portable writer task
const bootstrap = defineTask({
  label: 'Bootstrap secrets',
  envWriter: bootstrapSpec,              // unfulfilled
  run: async (r, ctx) => { ... },
});
await r.run(bootstrap, { envWriter: bootstrapEnv });
```

### Backwards compatibility

A bare `env: dbaEnv` (existing `Env` object) continues to work — pok treats it as an already-fulfilled spec where `vars` and `resolver` are both present. This makes the migration non-breaking.

### Runner changes

When executing a task:

1. Check if `task.env` is a `FulfilledEnvSpec`, an unfulfilled `EnvSpec`, or a legacy `Env`
2. For unfulfilled specs, require the env to be provided via `r.run(task, { env })` — throw if missing
3. For fulfilled specs / legacy envs, resolve from the bound resolver
4. Validate that `resolver.availableVars ⊇ spec.vars`
5. Call resolver(s) to fetch values
6. Populate `ctx.envs` and the env cache

### What happens to `defineEnv`

`defineEnv` currently bundles `{ resolver, vars }`. That bundle is split:

- **Spec side:** `defineEnvSpec(vars)` — just the var names
- **Binding:** `.using(env)` — attaches the resolver

`defineEnv` is deprecated but continues to work (treated as a fulfilled spec). It can be removed in a future major version.

### Type safety

The key type-level enforcement points:

- `EnvSpec.using(env)` — checks at definition time that `env.resolver.availableVars ⊇ spec.vars`
- `r.run(task, opts)` — when task has unfulfilled spec, `opts.env` is required (compile error if omitted)
- `ctx.envs` — typed from the spec's vars, not the full resolver's available vars (narrowed)

### What pok gains

With specs as a first-class concept:

- **Definition-time validation** — `env.vars ⊇ spec.vars` checked eagerly via `.using()`, not deferred to runtime
- **Resolution tracing** — `pok env inspect --env dev serverEnv` showing which resolver provides which var
- **Typed narrowing** — `ctx.envs` typed from the spec, not the full env

## Why not command-level binding

The original draft proposed binding at the command:

```ts
defineCommand({
  env: { resolver: opResolver },
  run: async (r) => {
    await r.run(migrate);
  },
});
```

This assumes one resolver can satisfy all tasks. In practice, commands like `deploy` orchestrate tasks with:

- Different resolver chains (vite, cloudflare, vault)
- Different var lists
- Different context shapes (`{ env }` vs `{ from, to }`)
- Writer-only tasks

A "mega composite" resolver flattens precedence and risks value leakage across environments. Spec-side binding keeps the resolver where domain knowledge lives — with the env object — and keeps commands as pure orchestrators.

## Approach

1. Add `EnvSpec` and `FulfilledEnvSpec` types, `defineEnvSpec` function with `.using()` method
2. Update `defineTask` to accept `EnvSpec | FulfilledEnvSpec | Env` for both `env` and `envWriter`
3. Update runner to detect fulfilment state and resolve accordingly
4. Update `r.run()` signature to conditionally require `{ env }` for unfulfilled specs
5. Deprecate `defineEnv` (keep working as fulfilled spec)
6. Update tests and mocks

## Hypothesis

Spec-side binding via `.using()` preserves the RFC's core insight (tasks declare vars-only contracts) while keeping resolver binding close to domain knowledge. Commands become pure orchestrators. Portable tasks opt in by omitting `.using()`, with TypeScript enforcing fulfilment at the call site.
