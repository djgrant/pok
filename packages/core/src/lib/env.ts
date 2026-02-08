import type { AnyEnvResolver, TypedEnvResolver, InferResolverContext } from './resolver';

/**
 * Environment definition - selects which variables to retrieve from a resolver.
 *
 * The env is the "frontend" that declares which subset of available variables
 * a task needs. The resolver handles the actual fetching.
 *
 * For writing, use `envWriter` on the task definition instead.
 */
export type Env<
  TContext = Record<string, unknown>,
  TVars extends string = string,
> = {
  resolver: AnyEnvResolver;
  vars: readonly TVars[];
  // Cached for type inference
  _contextType?: TContext;
  _varsType?: TVars;
};

/**
 * Infer the env vars type from an Env
 * Produces Record<TVar, string> for each selected var
 */
export type InferEnvVars<T> = T extends Env<any, infer V> ? Record<V, string> : never;

/**
 * Infer the required context from an Env (delegates to resolver)
 */
export type InferEnvContext<T> = T extends Env<infer C, any> ? C : never;

/**
 * Define an environment that selects variables from a resolver.
 *
 * @example
 * ```ts
 * // Given a resolver with available vars
 * const opResolver = defineEnvResolver({
 *   requiredContext: z.object({ env: z.enum(['dev', 'staging', 'prod']) }),
 *   availableVars: ['POSTGRES_URL', 'SUPABASE_URL', 'STRIPE_SECRET_KEY'] as const,
 *   resolve: async (keys, ctx) => { ... },
 * });
 *
 * // Select which vars this env needs
 * const dbaEnv = defineEnv({
 *   resolver: opResolver,
 *   vars: ['POSTGRES_URL'],
 * });
 *
 * // Use in a task for reading
 * const migrate = defineTask({
 *   env: dbaEnv,
 *   run: (r, ctx) => {
 *     ctx.envs.POSTGRES_URL // typed as string
 *   }
 * });
 *
 * // Use in a task for writing (envWriter enables ctx.writeEnvs)
 * const saveSecrets = defineTask({
 *   envWriter: bootstrapEnv,
 *   run: (r, ctx) => {
 *     await ctx.writeEnvs({ POSTGRES_URL: '...' });
 *   }
 * });
 * ```
 */
export function defineEnv<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TResolver extends TypedEnvResolver<any>,
  const TVars extends TResolver['availableVars'][number],
>(config: {
  resolver: TResolver;
  vars: readonly TVars[];
}): Env<InferResolverContext<TResolver>, TVars> {
  return {
    resolver: config.resolver,
    vars: config.vars,
  };
}

/**
 * Get the list of variable keys from an env
 */
export function getEnvKeys<T extends Env>(env: T): string[] {
  return [...env.vars];
}
