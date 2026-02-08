import { z } from 'zod';

/**
 * Branded type for environment variable keys.
 * Provides compile-time distinction between validated and unvalidated keys.
 */
export type EnvVarKey<T extends string = string> = T & { readonly __brand?: 'EnvVarKey' };

/**
 * Result type for resolver operations - only allows declared variable names.
 * This provides stricter return type validation at composition boundaries.
 */
export type ResolverResult<TAvailableVars extends string> = {
  [K in TAvailableVars]?: string;
};

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
  TContext extends z.ZodType = z.ZodType,
  TAvailableVars extends string = string,
> = {
  requiredContext: TContext;
  availableVars: readonly EnvVarKey<TAvailableVars>[];
  resolve: (
    keys: EnvVarKey<TAvailableVars>[],
    context: z.infer<TContext>
  ) => Promise<ResolverResult<TAvailableVars>> | ResolverResult<TAvailableVars>;

  /**
   * Optional write capability - persist values to the underlying store.
   * Not all resolvers support writing (e.g., composite resolvers are read-only).
   */
  write?: (values: ResolverResult<TAvailableVars>, context: z.infer<TContext>) => Promise<void>;
};

/**
 * Typed resolver that preserves available vars for type inference.
 * Use this return type when you need `defineEnv` to validate vars.
 *
 * The context is typed as `unknown` rather than `any` to encourage explicit validation.
 * Individual resolvers validate context against their `requiredContext` schema.
 */
export type TypedEnvResolver<TAvailableVars extends string = string> = {
  requiredContext: z.ZodType;
  availableVars: readonly EnvVarKey<TAvailableVars>[];
  resolve: (
    keys: EnvVarKey<TAvailableVars>[],
    context: unknown
  ) => Promise<ResolverResult<TAvailableVars>> | ResolverResult<TAvailableVars>;
  write?: (values: ResolverResult<TAvailableVars>, context: unknown) => Promise<void>;
};

/**
 * Type-erased resolver for use in generic contexts.
 * The `resolve` function accepts `unknown` context to encourage validation.
 * Uses `any` to allow resolvers with specific variable types to be used interchangeably.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEnvResolver = TypedEnvResolver<any>;

/**
 * Infer the context type required by a resolver
 */
export type InferResolverContext<T> = T extends EnvResolver<infer C, any> ? z.infer<C> : never;

/**
 * Infer the available vars from a resolver
 */
export type InferResolverVars<T> =
  T extends EnvResolver<any, infer V> ? V : T extends TypedEnvResolver<infer V> ? V : never;

/**
 * Validate that a set of keys are valid for a resolver's available vars.
 * Returns typed keys if valid, throws if invalid.
 */
export function validateResolverKeys<TAvailableVars extends string>(
  resolver: TypedEnvResolver<TAvailableVars>,
  keys: string[]
): EnvVarKey<TAvailableVars>[] {
  const availableSet = new Set(resolver.availableVars as readonly string[]);
  const invalidKeys = keys.filter((k) => !availableSet.has(k));

  if (invalidKeys.length > 0) {
    throw new Error(
      `Invalid resolver keys: ${invalidKeys.join(', ')}. ` +
        `Available: ${[...resolver.availableVars].join(', ')}`
    );
  }

  return keys as EnvVarKey<TAvailableVars>[];
}

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
}): TypedEnvResolver<TAvailableVars> {
  const requiredContext = config.requiredContext ?? (z.object({}) as unknown as TContext);

  return {
    requiredContext: requiredContext as z.ZodType,
    availableVars: config.availableVars as readonly EnvVarKey<TAvailableVars>[],
    resolve: (keys, context) => {
      // Validate context against the schema before resolving
      const validatedContext = requiredContext.parse(context);
      return config.resolve(keys, validatedContext);
    },
    write: config.write
      ? (values, context) => {
          // Validate context against the schema before writing
          const validatedContext = requiredContext.parse(context);
          return config.write!(values, validatedContext);
        }
      : undefined,
  };
}

/**
 * Create a static environment resolver that serves fixed values.
 * Useful for testing or simple configuration scenarios.
 *
 * @example
 * ```ts
 * const staticResolver = createStaticEnvResolver({
 *   vars: {
 *     API_URL: 'https://api.example.com',
 *     TIMEOUT: '5000',
 *   },
 * });
 * ```
 */
export function createStaticEnvResolver<
  TContext extends z.ZodType = z.ZodObject<{}>,
  const TVars extends Record<string, string> = Record<string, string>,
>(opts: {
  vars: TVars;
  requiredContext?: TContext;
}): TypedEnvResolver<Extract<keyof TVars, string>> {
  // We need to cast Object.keys result to make TypeScript happy with the generic TAvailableVars
  // In usage, TypeScript will infer the keys from the passed object literal
  const availableVars = Object.keys(opts.vars) as Extract<keyof TVars, string>[];

  return defineEnvResolver({
    requiredContext: opts.requiredContext,
    availableVars,
    resolve: (keys) => {
      const result: Record<string, string> = {};
      for (const key of keys) {
        if (key in opts.vars) {
          result[key] = opts.vars[key];
        }
      }
      return result as ResolverResult<Extract<keyof TVars, string>>;
    },
  });
}
