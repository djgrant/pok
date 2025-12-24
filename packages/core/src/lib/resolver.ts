import { z } from 'zod';

/**
 * Environment resolver - defines what context is needed and what variables
 * can be resolved (and optionally written).
 *
 * The resolver is the "backend" that knows how to fetch environment variables
 * given a context (e.g., which 1Password vault to use based on env).
 *
 * Resolvers can optionally implement a `write` method to persist values.
 */
export type EnvResolver<
  TContext extends z.ZodRawShape = z.ZodRawShape,
  TAvailableVars extends string = string,
> = {
  requiredContext: z.ZodObject<TContext>;
  availableVars: readonly TAvailableVars[];
  resolve: (
    keys: string[],
    context: z.infer<z.ZodObject<TContext>>
  ) => Promise<Record<string, string>> | Record<string, string>;

  /**
   * Optional write capability - persist values to the underlying store.
   * Not all resolvers support writing (e.g., composite resolvers are read-only).
   */
  write?: (
    values: Record<string, string>,
    context: z.infer<z.ZodObject<TContext>>
  ) => Promise<void>;
};

/**
 * Typed resolver that preserves available vars for type inference.
 * Use this return type when you need `defineEnv` to validate vars.
 */
export type TypedEnvResolver<TAvailableVars extends string = string> = {
  requiredContext: z.ZodObject<z.ZodRawShape>;
  availableVars: readonly TAvailableVars[];
  resolve: (
    keys: string[],
    context: any
  ) => Promise<Record<string, string>> | Record<string, string>;
  write?: (values: Record<string, string>, context: any) => Promise<void>;
};

/**
 * Type-erased resolver for use in generic contexts.
 * The `resolve` function accepts `any` context to avoid contravariance issues.
 */
export type AnyEnvResolver = TypedEnvResolver<string>;

/**
 * Infer the context type required by a resolver
 */
export type InferResolverContext<T> =
  T extends EnvResolver<infer C, any> ? z.infer<z.ZodObject<C>> : never;

/**
 * Infer the available vars from a resolver
 */
export type InferResolverVars<T> =
  T extends EnvResolver<any, infer V> ? V : never;

/**
 * Define an environment resolver.
 *
 * @example
 * ```ts
 * const opResolver = defineEnvResolver({
 *   requiredContext: z.object({ env: z.enum(['dev', 'staging', 'prod']) }),
 *   availableVars: [
 *     'POSTGRES_URL',
 *     'SUPABASE_URL',
 *     'STRIPE_SECRET_KEY',
 *   ] as const,
 *   resolve: async (keys, ctx) => {
 *     // Fetch from 1Password based on ctx.env
 *     return { ... };
 *   },
 *   write: async (values, ctx) => {
 *     // Optionally persist values
 *   },
 * });
 * ```
 */
export function defineEnvResolver<
  TContext extends z.ZodRawShape,
  const TAvailableVars extends string,
>(config: {
  requiredContext: z.ZodObject<TContext>;
  availableVars: readonly TAvailableVars[];
  resolve: (
    keys: string[],
    context: z.infer<z.ZodObject<TContext>>
  ) => Promise<Record<string, string>> | Record<string, string>;
  write?: (
    values: Record<string, string>,
    context: z.infer<z.ZodObject<TContext>>
  ) => Promise<void>;
}): TypedEnvResolver<TAvailableVars> {
  return config as TypedEnvResolver<TAvailableVars>;
}
