import { z } from 'zod';
import type { TypedEnvResolver, ResolverResult } from '@pokit/core';
import { type OpVault, type InferOpVaultKeys, parseOpRef } from './vault';
import * as op from './op';

type KeyMapping = {
  key: string;
  item: string;
  field: string;
};

export type OpResolverConfig<TVault extends OpVault<any>, TEnvs extends string> = {
  vault: TVault;
  vaults: Record<TEnvs, string>;
};

/**
 * Define a 1Password resolver that fetches and writes secrets to 1Password vaults.
 *
 * @example
 * ```ts
 * const vault = defineOpVault({
 *   POSTGRES_URL: 'supabase:SUPABASE_SESSION_DSN',
 *   SUPABASE_URL: 'supabase:SUPABASE_URL',
 * });
 *
 * const opResolver = defineOpResolver({
 *   vault,
 *   vaults: {
 *     dev: 'my-app-secrets-dev',
 *     staging: 'my-app-secrets-staging',
 *     prod: 'my-app-secrets-prod',
 *   },
 * });
 * ```
 */
export function defineOpResolver<TVault extends OpVault<any>, const TEnvs extends string>(
  config: OpResolverConfig<TVault, TEnvs>
): TypedEnvResolver<InferOpVaultKeys<TVault> & string> {
  type VaultKey = InferOpVaultKeys<TVault> & string;
  const envValues = Object.keys(config.vaults) as TEnvs[];
  const availableVars = Object.keys(config.vault.secrets) as VaultKey[];

  return {
    requiredContext: z.object({
      env: z.enum(envValues as [TEnvs, ...TEnvs[]]),
    }),
    availableVars,

    resolve: async (keys, context) => {
      const ctx = z.object({ env: z.enum(envValues as [TEnvs, ...TEnvs[]]) }).parse(context);
      const vaultName = config.vaults[ctx.env as TEnvs];
      if (!vaultName) {
        throw new Error(`No vault configured for environment: ${ctx.env}`);
      }

      // Build mapping of keys to their 1Password item/field locations
      const keyMappings: KeyMapping[] = [];
      const unknownKeys: string[] = [];

      for (const key of keys) {
        const ref = config.vault.secrets[key];
        if (!ref) {
          unknownKeys.push(key);
          continue;
        }
        const { item, field } = parseOpRef(ref);
        keyMappings.push({ key, item, field });
      }

      if (unknownKeys.length > 0) {
        throw new Error(`No secret config for keys: ${unknownKeys.join(', ')}`);
      }

      // Group by item name to minimize 1Password calls
      const itemNames = [...new Set(keyMappings.map((m) => m.item))];

      // Fetch all items in parallel
      const items = await op.getItemsBatch(vaultName, itemNames);

      // Extract requested fields from fetched items
      const result: Record<string, string> = {};
      const missingSecrets: string[] = [];

      for (const { key, item, field } of keyMappings) {
        const opItem = items.get(item);
        if (!opItem) {
          missingSecrets.push(`op://${vaultName}/${item}/${field} (item not found)`);
          continue;
        }

        const value = opItem.fields[field];
        if (value === undefined) {
          missingSecrets.push(`op://${vaultName}/${item}/${field} (field not found)`);
          continue;
        }

        result[key] = value;
      }

      if (missingSecrets.length > 0) {
        throw new Error(
          `Failed to fetch secrets from 1Password:\n  - ${missingSecrets.join('\n  - ')}`
        );
      }

      return result as ResolverResult<VaultKey>;
    },

    write: async (values, context) => {
      const ctx = z.object({ env: z.enum(envValues as [TEnvs, ...TEnvs[]]) }).parse(context);
      const vaultName = config.vaults[ctx.env as TEnvs];
      if (!vaultName) {
        throw new Error(`No vault configured for environment: ${ctx.env}`);
      }

      // Group values by 1Password item for batch writes
      const byItem = new Map<string, Record<string, string>>();

      for (const [key, value] of Object.entries(values) as [string, string | undefined][]) {
        if (value === undefined) continue;

        const ref = config.vault.secrets[key];
        if (!ref) {
          throw new Error(
            `Unknown variable "${key}". ` + `Ensure it is declared in the vault configuration.`
          );
        }

        const { item, field } = parseOpRef(ref);
        if (!byItem.has(item)) {
          byItem.set(item, {});
        }
        byItem.get(item)![field] = value;
      }

      // Batch write each item (fail fast on error)
      for (const [item, fields] of byItem) {
        await op.setFieldsBatch(vaultName, item, fields);
      }
    },
  };
}
