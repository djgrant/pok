import { validateSync, type StandardSchemaV1 } from '../../core/src/lib/schema';
import { describe, it, expect } from 'bun:test';
import { defineOpVault } from '../src/vault';
import { defineOpResolver } from '../src/resolver';

const accepts = (schema: StandardSchemaV1, value: unknown): boolean =>
  !validateSync(schema, value).issues;

// =============================================================================
// Note: These tests focus on the resolver structure and validation logic.
// Actual 1Password API calls require the `op` CLI to be installed and
// authenticated, which is tested via integration tests.
// =============================================================================

// =============================================================================
// Test Fixtures
// =============================================================================

const testVault = defineOpVault({
  POSTGRES_URL: 'supabase:SUPABASE_SESSION_DSN',
  SUPABASE_URL: 'supabase:SUPABASE_URL',
  STRIPE_SECRET_KEY: 'stripe:STRIPE_SECRET_KEY',
});

// =============================================================================
// defineOpResolver Structure Tests
// =============================================================================

describe('defineOpResolver', () => {
  describe('resolver structure', () => {
    it('returns resolver with correct shape', () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'my-app-secrets-dev',
          staging: 'my-app-secrets-staging',
          prod: 'my-app-secrets-prod',
        },
      });

      expect(resolver).toHaveProperty('requiredContext');
      expect(resolver).toHaveProperty('availableVars');
      expect(resolver).toHaveProperty('resolve');
      expect(resolver).toHaveProperty('write');
    });

    it('includes all vault keys in availableVars', () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'dev-vault',
          prod: 'prod-vault',
        },
      });

      expect(resolver.availableVars).toContain('POSTGRES_URL');
      expect(resolver.availableVars).toContain('SUPABASE_URL');
      expect(resolver.availableVars).toContain('STRIPE_SECRET_KEY');
      expect(resolver.availableVars).toHaveLength(3);
    });

    it('requiredContext schema validates env values', () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'dev-vault',
          staging: 'staging-vault',
          prod: 'prod-vault',
        },
      });

      // Valid environments should pass
      expect(accepts(resolver.requiredContext, { env: 'dev' })).toBe(true);
      expect(accepts(resolver.requiredContext, { env: 'staging' })).toBe(true);
      expect(accepts(resolver.requiredContext, { env: 'prod' })).toBe(true);

      // Invalid environment should fail
      expect(accepts(resolver.requiredContext, { env: 'invalid' })).toBe(false);
    });
  });

  describe('resolve function behavior', () => {
    it('throws for unknown environment', async () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'dev-vault',
        },
      });

      // Bypass type checking to test runtime error
      // The context is validated first, so we get a validation error
      await expect(resolver.resolve(['POSTGRES_URL'], { env: 'unknown' } as any)).rejects.toThrow(
        'Invalid 1Password resolver context: Expected one of: dev'
      );
    });

    it('throws for unknown keys', async () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'dev-vault',
        },
      });

      await expect(resolver.resolve(['UNKNOWN_KEY'] as any, { env: 'dev' })).rejects.toThrow(
        'No secret config for keys: UNKNOWN_KEY'
      );
    });

    it('throws for multiple unknown keys', async () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'dev-vault',
        },
      });

      await expect(
        resolver.resolve(['UNKNOWN_KEY_1', 'UNKNOWN_KEY_2'] as any, { env: 'dev' })
      ).rejects.toThrow('No secret config for keys: UNKNOWN_KEY_1, UNKNOWN_KEY_2');
    });
  });

  describe('write function behavior', () => {
    it('throws for unknown environment', async () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'dev-vault',
        },
      });

      // Bypass type checking to test runtime error
      // The context is validated first, so we get a validation error
      await expect(
        resolver.write!({ POSTGRES_URL: 'test' }, { env: 'unknown' } as any)
      ).rejects.toThrow(
        'Invalid 1Password resolver context: Expected one of: dev'
      );
    });

    it('throws for unknown variable', async () => {
      const resolver = defineOpResolver({
        vault: testVault,
        vaults: {
          dev: 'dev-vault',
        },
      });

      await expect(resolver.write!({ UNKNOWN_VAR: 'test' } as any, { env: 'dev' })).rejects.toThrow(
        'Unknown variable "UNKNOWN_VAR"'
      );
    });
  });
});

// =============================================================================
// Vault Environment Mapping Tests
// =============================================================================

describe('vault environment mapping', () => {
  it('maps different vaults to different environments', () => {
    const resolver = defineOpResolver({
      vault: testVault,
      vaults: {
        dev: 'acme-dev-secrets',
        staging: 'acme-staging-secrets',
        prod: 'acme-prod-secrets',
      },
    });

    // The resolver is configured correctly - actual vault access is tested
    // via integration tests
    expect(accepts(resolver.requiredContext, { env: 'dev' })).toBe(true);
    expect(accepts(resolver.requiredContext, { env: 'staging' })).toBe(true);
    expect(accepts(resolver.requiredContext, { env: 'prod' })).toBe(true);
  });

  it('supports single environment', () => {
    const resolver = defineOpResolver({
      vault: testVault,
      vaults: {
        prod: 'production-secrets',
      },
    });

    expect(accepts(resolver.requiredContext, { env: 'prod' })).toBe(true);
    expect(accepts(resolver.requiredContext, { env: 'dev' })).toBe(false);
  });

  it('supports custom environment names', () => {
    const resolver = defineOpResolver({
      vault: testVault,
      vaults: {
        local: 'local-secrets',
        preview: 'preview-secrets',
        production: 'production-secrets',
      },
    });

    expect(accepts(resolver.requiredContext, { env: 'local' })).toBe(true);
    expect(accepts(resolver.requiredContext, { env: 'preview' })).toBe(true);
    expect(accepts(resolver.requiredContext, { env: 'production' })).toBe(true);
  });
});
