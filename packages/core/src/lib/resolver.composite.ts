import { z } from 'zod';
import type { TypedEnvResolver, EnvVarKey, ResolverResult } from './resolver';

/**
 * Helper to extract available vars from resolvers.
 * Uses branded EnvVarKey type for type safety at composition boundaries.
 */
type ExtractAvailableVars<T extends readonly TypedEnvResolver<string>[]> =
  T[number]['availableVars'][number] extends EnvVarKey<infer V> ? V : string;

/**
 * Configuration for composite resolver.
 * Provides explicit typing for resolver array.
 */
export type CompositeResolverConfig<TResolvers extends readonly TypedEnvResolver<string>[]> = {
  resolvers: TResolvers;
};

/**
 * Define a composite resolver that combines multiple resolvers.
 * Resolvers are tried in order; first one that can provide a key wins.
 *
 * Type safety is preserved at composition boundaries:
 * - Available vars are unioned from all resolvers
 * - Context validation is performed by individual resolvers
 * - Return types are constrained to declared variables only
 *
 * @example
 * ```ts
 * const secretsResolver = defineCompositeResolver({
 *   resolvers: [
 *     devStaticResolver,      // highest priority
 *     supabaseStatusResolver, // next
 *     opResolver,             // fallback
 *   ],
 * });
 * ```
 */
export function defineCompositeResolver<
  const TResolvers extends readonly TypedEnvResolver<string>[],
>(
  config: CompositeResolverConfig<TResolvers>
): TypedEnvResolver<ExtractAvailableVars<TResolvers>> {
  type CompositeVars = ExtractAvailableVars<TResolvers>;

  // Collect all available vars from all resolvers (union)
  const allVars = new Set<string>();
  for (const resolver of config.resolvers) {
    for (const v of resolver.availableVars) {
      allVars.add(v as string);
    }
  }

  // Merge all requiredContext schemas
  // For now, we'll create a loose schema that accepts any context
  // and let individual resolvers validate what they need
  const mergedContext = z.object({}).passthrough();

  return {
    requiredContext: mergedContext as z.ZodObject<z.ZodRawShape>,
    availableVars: [...allVars] as EnvVarKey<CompositeVars>[],
    resolve: async (keys, context): Promise<ResolverResult<CompositeVars>> => {
      const result: ResolverResult<CompositeVars> = {};
      const remainingKeys = new Set(keys as string[]);
      const errors: Array<{ resolver: string; keys: string[]; error: string }> = [];

      for (const resolver of config.resolvers) {
        if (remainingKeys.size === 0) break;

        // Check which keys this resolver can provide
        const resolverVars = new Set(resolver.availableVars as readonly string[]);
        const keysForThisResolver = [...remainingKeys].filter((k) => resolverVars.has(k));

        if (keysForThisResolver.length === 0) continue;

        // Check if context satisfies this resolver's requirements
        const contextResult = resolver.requiredContext.safeParse(context);
        if (!contextResult.success) continue;

        // Try to resolve
        try {
          const resolved = await resolver.resolve(
            keysForThisResolver as EnvVarKey<string>[],
            context
          );

          for (const [key, value] of Object.entries(resolved)) {
            if (value !== undefined && value !== null) {
              (result as Record<string, string>)[key] = value;
              remainingKeys.delete(key);
            }
          }
        } catch (error) {
          const resolverName = 'name' in resolver ? (resolver.name as string) : 'unnamed resolver';
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            resolver: resolverName,
            keys: keysForThisResolver,
            error: errorMessage,
          });
          // Continue to next resolver
          continue;
        }
      }

      // Log warnings for unresolved keys if there were errors
      if (remainingKeys.size > 0 && errors.length > 0 && process.env.DEBUG) {
        console.warn(
          `[composite-resolver] Failed to resolve keys [${[...remainingKeys].join(', ')}]. Errors encountered:`
        );
        for (const { resolver, keys, error } of errors) {
          console.warn(`  - ${resolver} (keys: ${keys.join(', ')}): ${error}`);
        }
      }

      return result;
    },
  };
}
