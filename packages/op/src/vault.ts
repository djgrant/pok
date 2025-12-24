/**
 * Vault definition for 1Password secrets.
 *
 * Each entry maps a variable name to an "item:field" reference.
 * Format: `"itemName:fieldName"` where both are required.
 *
 * @example
 * ```ts
 * const vault = defineOpVault({
 *   POSTGRES_URL: 'supabase:SUPABASE_SESSION_DSN',
 *   SUPABASE_URL: 'supabase:SUPABASE_URL',
 *   STRIPE_SECRET_KEY: 'stripe:STRIPE_SECRET_KEY',
 * });
 * ```
 */

export type OpVaultRef = `${string}:${string}`;

export type OpVault<TSecrets extends Record<string, OpVaultRef>> = {
  secrets: TSecrets;
};

export type InferOpVaultKeys<T> = T extends OpVault<infer S> ? keyof S : never;

/**
 * Parse an "item:field" reference into its components.
 */
export function parseOpRef(ref: OpVaultRef): { item: string; field: string } {
  const colonIndex = ref.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`Invalid vault reference: ${ref}. Expected "item:field".`);
  }
  return {
    item: ref.slice(0, colonIndex),
    field: ref.slice(colonIndex + 1),
  };
}

/**
 * Define a vault with typed secret declarations.
 *
 * @example
 * ```ts
 * const vault = defineOpVault({
 *   POSTGRES_URL: 'supabase:SUPABASE_SESSION_DSN',
 *   SUPABASE_URL: 'supabase:SUPABASE_URL',
 *   VITE_SUPABASE_URL: 'supabase:SUPABASE_URL',
 * });
 * ```
 */
export function defineOpVault<
  const TSecrets extends Record<string, OpVaultRef>,
>(secrets: TSecrets): OpVault<TSecrets> {
  return { secrets };
}
