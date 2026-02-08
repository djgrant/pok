# Resolver Flexible Context Schema

## Goal/Problem

`defineEnvResolver` constrains `requiredContext` to `z.ZodObject<TContext>`, which prevents resolvers from using any other Zod schema that yields an object — such as `z.discriminatedUnion`, `z.union`, or `z.intersection`.

A resolver that behaves differently depending on provider cannot express its context:

```ts
const resolver = defineEnvResolver({
  requiredContext: z.discriminatedUnion('provider', [
    z.object({ provider: z.literal('aws'), region: z.string() }),
    z.object({ provider: z.literal('gcp'), project: z.string() }),
  ]),
  availableVars: ['SECRET_KEY'] as const,
  resolve: async (keys, ctx) => {
    // ctx is narrowed by discriminant — but this doesn't compile today
  },
});
```

This fails because every `requiredContext` reference in the resolver system is typed as `z.ZodObject`. The runtime already calls `.parse()`, which works for any `z.ZodType` — so this is primarily a type-level change.

## Scope

- `packages/core/src/lib/resolver.ts` — `EnvResolver`, `TypedEnvResolver`, `defineEnvResolver`, `createStaticEnvResolver`, `InferResolverContext`
- `packages/core/src/lib/resolver.composite.ts` — `requiredContext` field type and `.safeParse()` call
- `packages/core/src/lib/env.ts` — `InferEnvContext` (currently infers from `Env<infer C>`, not directly from the Zod schema, but verify it still works)

## Design

### Widen `EnvResolver.requiredContext` to `z.ZodType`

Replace the `TContext extends z.ZodRawShape` pattern with `TContext extends z.ZodType`:

```ts
export type EnvResolver<
  TContext extends z.ZodType = z.ZodType,
  TAvailableVars extends string = string,
> = {
  requiredContext: TContext;
  availableVars: readonly EnvVarKey<TAvailableVars>[];
  resolve: (
    keys: EnvVarKey<TAvailableVars>[],
    context: z.infer<TContext>
  ) => Promise<ResolverResult<TAvailableVars>> | ResolverResult<TAvailableVars>;
  write?: (values: ResolverResult<TAvailableVars>, context: z.infer<TContext>) => Promise<void>;
};
```

### Widen `TypedEnvResolver.requiredContext` to `z.ZodType`

```ts
export type TypedEnvResolver<TAvailableVars extends string = string> = {
  requiredContext: z.ZodType;
  // ... rest unchanged
};
```

### Update `defineEnvResolver` signature

```ts
export function defineEnvResolver<
  TContext extends z.ZodType = z.ZodObject<{}>,
  const TAvailableVars extends string = string,
>(config: {
  requiredContext?: TContext;
  availableVars: readonly TAvailableVars[];
  resolve: (
    keys: EnvVarKey<TAvailableVars>[],
    context: z.infer<TContext>
  ) => Promise<ResolverResult<TAvailableVars>> | ResolverResult<TAvailableVars>;
  write?: (values: ResolverResult<TAvailableVars>, context: z.infer<TContext>) => Promise<void>;
}): TypedEnvResolver<TAvailableVars>;
```

The default for `requiredContext` remains `z.object({})` at runtime.

### Simplify `InferResolverContext`

Currently infers through `z.ZodObject<C>` indirection. Simplify to:

```ts
export type InferResolverContext<T> = T extends EnvResolver<infer C, any> ? z.infer<C> : never;
```

### Composite resolver

`resolver.composite.ts` stores `requiredContext` typed as `z.ZodObject<z.ZodRawShape>` — widen to `z.ZodType`. The `.safeParse()` call already works for any `z.ZodType`.

### `createStaticEnvResolver`

Widen its optional `requiredContext` parameter from `z.ZodObject<TContext>` to `TContext extends z.ZodType`.

## Approach

1. Update `EnvResolver` — replace `z.ZodRawShape` / `z.ZodObject<TContext>` with `TContext extends z.ZodType`
2. Update `TypedEnvResolver` — widen `requiredContext` from `z.ZodObject<z.ZodRawShape>` to `z.ZodType`
3. Update `defineEnvResolver` — new generic bound, update cast in return value
4. Update `createStaticEnvResolver` — widen `requiredContext` parameter
5. Simplify `InferResolverContext`
6. Update `resolver.composite.ts` — widen the `requiredContext` type in the return value
7. Verify `InferEnvContext` in `env.ts` still infers correctly (it delegates to `InferResolverContext`)
8. Add tests with `z.discriminatedUnion`, `z.union`, and `z.intersection` schemas

## Hypothesis

This is a type-level change. Runtime behaviour (`.parse()` / `.safeParse()`) already works for any Zod schema. The main risk is downstream type inference — specifically that `InferResolverContext` and `InferEnvContext` continue to produce the correct inferred types after widening the generic bound.
