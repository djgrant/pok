import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { defineEnvResolver, defineCompositeResolver, createStaticEnvResolver } from '../src';

// =============================================================================
// defineEnvResolver Tests
// =============================================================================

describe('defineEnvResolver', () => {
  describe('structure', () => {
    it('returns resolver with correct properties', () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({
          env: z.enum(['dev', 'prod']),
        }),
        availableVars: ['VAR_A', 'VAR_B'] as const,
        resolve: async () => ({ VAR_A: 'a', VAR_B: 'b' }),
      });

      expect(resolver).toHaveProperty('requiredContext');
      expect(resolver).toHaveProperty('availableVars');
      expect(resolver).toHaveProperty('resolve');
    });

    it('preserves availableVars', () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({}),
        availableVars: ['DATABASE_URL', 'API_KEY', 'SECRET'] as const,
        resolve: async () => ({}),
      });

      expect(resolver.availableVars).toEqual(['DATABASE_URL', 'API_KEY', 'SECRET']);
    });

    it('includes write function when provided', () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({}),
        availableVars: ['VAR'] as const,
        resolve: async () => ({}),
        write: async () => {},
      });

      expect(resolver.write).toBeDefined();
      expect(typeof resolver.write).toBe('function');
    });

    it('omits write function when not provided', () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({}),
        availableVars: ['VAR'] as const,
        resolve: async () => ({}),
      });

      expect(resolver.write).toBeUndefined();
    });
  });

  describe('requiredContext validation', () => {
    it('validates context with enum', () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({
          env: z.enum(['dev', 'staging', 'prod']),
        }),
        availableVars: ['VAR'] as const,
        resolve: async () => ({}),
      });

      expect(resolver.requiredContext.safeParse({ env: 'dev' }).success).toBe(true);
      expect(resolver.requiredContext.safeParse({ env: 'staging' }).success).toBe(true);
      expect(resolver.requiredContext.safeParse({ env: 'prod' }).success).toBe(true);
      expect(resolver.requiredContext.safeParse({ env: 'invalid' }).success).toBe(false);
    });

    it('validates context with multiple fields', () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({
          env: z.enum(['dev', 'prod']),
          region: z.enum(['us', 'eu']),
        }),
        availableVars: ['VAR'] as const,
        resolve: async () => ({}),
      });

      expect(
        resolver.requiredContext.safeParse({
          env: 'dev',
          region: 'us',
        }).success
      ).toBe(true);

      expect(
        resolver.requiredContext.safeParse({
          env: 'dev',
          // missing region
        }).success
      ).toBe(false);
    });
  });

  describe('resolve function', () => {
    it('supports synchronous resolve', async () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({}),
        availableVars: ['VAR'] as const,
        resolve: () => ({ VAR: 'sync-value' }),
      });

      const result = await resolver.resolve(['VAR'], {});
      expect(result).toEqual({ VAR: 'sync-value' });
    });

    it('supports asynchronous resolve', async () => {
      const resolver = defineEnvResolver({
        requiredContext: z.object({}),
        availableVars: ['VAR'] as const,
        resolve: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { VAR: 'async-value' };
        },
      });

      const result = await resolver.resolve(['VAR'], {});
      expect(result).toEqual({ VAR: 'async-value' });
    });

    it('receives keys and context', async () => {
      let receivedKeys: string[] = [];
      let receivedContext: any = null;

      const resolver = defineEnvResolver({
        requiredContext: z.object({
          env: z.enum(['dev', 'prod']),
        }),
        availableVars: ['VAR_A', 'VAR_B'] as const,
        resolve: (keys, ctx) => {
          receivedKeys = keys;
          receivedContext = ctx;
          return {};
        },
      });

      await resolver.resolve(['VAR_A', 'VAR_B'], { env: 'dev' });

      expect(receivedKeys).toEqual(['VAR_A', 'VAR_B']);
      expect(receivedContext).toEqual({ env: 'dev' });
    });
  });

  describe('write function', () => {
    it('receives values and context', async () => {
      let receivedValues: Record<string, string> = {};
      let receivedContext: any = null;

      const resolver = defineEnvResolver({
        requiredContext: z.object({
          env: z.enum(['dev', 'prod']),
        }),
        availableVars: ['VAR'] as const,
        resolve: async () => ({}),
        write: async (values, ctx) => {
          receivedValues = values;
          receivedContext = ctx;
        },
      });

      await resolver.write!({ VAR: 'new-value' }, { env: 'prod' });

      expect(receivedValues).toEqual({ VAR: 'new-value' });
      expect(receivedContext).toEqual({ env: 'prod' });
    });
  });
});

// =============================================================================
// Flexible Context Schema Tests
// =============================================================================

describe('flexible context schemas', () => {
  it('accepts z.discriminatedUnion as requiredContext', async () => {
    const resolver = defineEnvResolver({
      requiredContext: z.discriminatedUnion('provider', [
        z.object({ provider: z.literal('aws'), region: z.string() }),
        z.object({ provider: z.literal('gcp'), project: z.string() }),
      ]),
      availableVars: ['SECRET_KEY'] as const,
      resolve: async (_keys, ctx) => {
        if (ctx.provider === 'aws') {
          return { SECRET_KEY: `aws-${ctx.region}` };
        }
        return { SECRET_KEY: `gcp-${ctx.project}` };
      },
    });

    const awsResult = await resolver.resolve(['SECRET_KEY'], { provider: 'aws', region: 'us-east-1' });
    expect(awsResult).toEqual({ SECRET_KEY: 'aws-us-east-1' });

    const gcpResult = await resolver.resolve(['SECRET_KEY'], { provider: 'gcp', project: 'my-proj' });
    expect(gcpResult).toEqual({ SECRET_KEY: 'gcp-my-proj' });
  });

  it('rejects invalid discriminatedUnion context', () => {
    const resolver = defineEnvResolver({
      requiredContext: z.discriminatedUnion('provider', [
        z.object({ provider: z.literal('aws'), region: z.string() }),
        z.object({ provider: z.literal('gcp'), project: z.string() }),
      ]),
      availableVars: ['SECRET_KEY'] as const,
      resolve: async () => ({ SECRET_KEY: 'value' }),
    });

    expect(() => resolver.resolve(['SECRET_KEY'], { provider: 'azure' })).toThrow();
  });

  it('accepts z.union as requiredContext', async () => {
    const resolver = defineEnvResolver({
      requiredContext: z.union([
        z.object({ env: z.literal('dev'), debug: z.boolean() }),
        z.object({ env: z.literal('prod') }),
      ]),
      availableVars: ['API_URL'] as const,
      resolve: async (_keys, ctx) => {
        return { API_URL: ctx.env === 'dev' ? 'http://localhost' : 'https://api.example.com' };
      },
    });

    const devResult = await resolver.resolve(['API_URL'], { env: 'dev', debug: true });
    expect(devResult).toEqual({ API_URL: 'http://localhost' });

    const prodResult = await resolver.resolve(['API_URL'], { env: 'prod' });
    expect(prodResult).toEqual({ API_URL: 'https://api.example.com' });
  });

  it('accepts z.intersection as requiredContext', async () => {
    const resolver = defineEnvResolver({
      requiredContext: z.intersection(
        z.object({ env: z.enum(['dev', 'prod']) }),
        z.object({ region: z.string() })
      ),
      availableVars: ['DB_URL'] as const,
      resolve: async (_keys, ctx) => {
        return { DB_URL: `${ctx.env}-${ctx.region}` };
      },
    });

    const result = await resolver.resolve(['DB_URL'], { env: 'dev', region: 'us-east-1' });
    expect(result).toEqual({ DB_URL: 'dev-us-east-1' });

    expect(() => resolver.resolve(['DB_URL'], { env: 'dev' })).toThrow();
  });

  it('works with discriminatedUnion in composite resolver', async () => {
    const awsGcpResolver = defineEnvResolver({
      requiredContext: z.discriminatedUnion('provider', [
        z.object({ provider: z.literal('aws'), region: z.string() }),
        z.object({ provider: z.literal('gcp'), project: z.string() }),
      ]),
      availableVars: ['CLOUD_SECRET'] as const,
      resolve: async (_keys, ctx) => {
        return { CLOUD_SECRET: `${ctx.provider}-secret` };
      },
    });

    const staticResolver = createStaticEnvResolver({
      vars: { STATIC_VAR: 'static-value' },
    });

    const composite = defineCompositeResolver({
      resolvers: [awsGcpResolver, staticResolver],
    });

    const result = await composite.resolve(['CLOUD_SECRET', 'STATIC_VAR'], {
      provider: 'aws',
      region: 'us-west-2',
    });

    expect(result.CLOUD_SECRET).toBe('aws-secret');
    expect(result.STATIC_VAR).toBe('static-value');
  });
});

// =============================================================================
// defineCompositeResolver Tests
// =============================================================================

describe('defineCompositeResolver', () => {
  // Create test resolvers
  const createResolver = (prefix: string, vars: readonly string[]) =>
    defineEnvResolver({
      requiredContext: z.object({
        env: z.enum(['dev', 'prod']),
      }),
      availableVars: vars,
      resolve: (keys, ctx) => {
        const result: Record<string, string> = {};
        for (const key of keys) {
          result[key] = `${prefix}-${ctx.env}-${key}`;
        }
        return result;
      },
    });

  describe('structure', () => {
    it('returns resolver with correct shape', () => {
      const resolver1 = createResolver('r1', ['VAR_A']);
      const resolver2 = createResolver('r2', ['VAR_B']);

      const composite = defineCompositeResolver({
        resolvers: [resolver1, resolver2],
      });

      expect(composite).toHaveProperty('requiredContext');
      expect(composite).toHaveProperty('availableVars');
      expect(composite).toHaveProperty('resolve');
    });

    it('combines availableVars from all resolvers', () => {
      const resolver1 = createResolver('r1', ['VAR_A', 'VAR_B']);
      const resolver2 = createResolver('r2', ['VAR_C', 'VAR_D']);

      const composite = defineCompositeResolver({
        resolvers: [resolver1, resolver2],
      });

      expect(composite.availableVars).toContain('VAR_A');
      expect(composite.availableVars).toContain('VAR_B');
      expect(composite.availableVars).toContain('VAR_C');
      expect(composite.availableVars).toContain('VAR_D');
    });

    it('deduplicates overlapping availableVars', () => {
      const resolver1 = createResolver('r1', ['VAR_A', 'VAR_B']);
      const resolver2 = createResolver('r2', ['VAR_B', 'VAR_C']);

      const composite = defineCompositeResolver({
        resolvers: [resolver1, resolver2],
      });

      // Should not have duplicates
      const uniqueVars = [...new Set(composite.availableVars)];
      expect(composite.availableVars).toHaveLength(uniqueVars.length);
    });
  });

  describe('resolve', () => {
    it('resolves from correct resolver based on availableVars', async () => {
      const resolver1 = createResolver('r1', ['VAR_A']);
      const resolver2 = createResolver('r2', ['VAR_B']);

      const composite = defineCompositeResolver({
        resolvers: [resolver1, resolver2],
      });

      const result = await composite.resolve(['VAR_A', 'VAR_B'], { env: 'dev' });

      expect(result.VAR_A).toBe('r1-dev-VAR_A');
      expect(result.VAR_B).toBe('r2-dev-VAR_B');
    });

    it('uses first resolver for overlapping vars', async () => {
      const resolver1 = createResolver('r1', ['SHARED_VAR']);
      const resolver2 = createResolver('r2', ['SHARED_VAR']);

      const composite = defineCompositeResolver({
        resolvers: [resolver1, resolver2],
      });

      const result = await composite.resolve(['SHARED_VAR'], { env: 'dev' });

      // First resolver wins
      expect(result.SHARED_VAR).toBe('r1-dev-SHARED_VAR');
    });
  });

  describe('write behavior', () => {
    it('does not have write function (read-only)', () => {
      const resolver = createResolver('r1', ['VAR']);
      const composite = defineCompositeResolver({
        resolvers: [resolver],
      });

      // Composite resolvers are read-only by design
      expect(composite.write).toBeUndefined();
    });
  });

  describe('context handling', () => {
    it('uses passthrough for flexible context', () => {
      const resolver1 = defineEnvResolver({
        requiredContext: z.object({
          env: z.enum(['dev', 'prod']),
        }),
        availableVars: ['VAR_A'] as const,
        resolve: () => ({}),
      });

      const resolver2 = defineEnvResolver({
        requiredContext: z.object({
          region: z.enum(['us', 'eu']),
        }),
        availableVars: ['VAR_B'] as const,
        resolve: () => ({}),
      });

      const composite = defineCompositeResolver({
        resolvers: [resolver1, resolver2] as const,
      });

      // Composite uses passthrough - accepts any context and lets
      // individual resolvers validate what they need
      expect(composite.requiredContext.safeParse({ env: 'dev' }).success).toBe(true);
      expect(composite.requiredContext.safeParse({ region: 'us' }).success).toBe(true);
      expect(
        composite.requiredContext.safeParse({
          env: 'dev',
          region: 'us',
        }).success
      ).toBe(true);
      // Even empty context is accepted (validation happens per-resolver)
      expect(composite.requiredContext.safeParse({}).success).toBe(true);
    });

    it('throws when required context is missing for unresolved keys', async () => {
      let resolver1Called = false;
      let resolver2Called = false;

      const resolver1 = defineEnvResolver({
        requiredContext: z.object({
          env: z.enum(['dev', 'prod']),
        }),
        availableVars: ['VAR_A'] as const,
        resolve: () => {
          resolver1Called = true;
          return { VAR_A: 'from-r1' };
        },
      });

      const resolver2 = defineEnvResolver({
        requiredContext: z.object({
          region: z.enum(['us', 'eu']),
        }),
        availableVars: ['VAR_B'] as const,
        resolve: () => {
          resolver2Called = true;
          return { VAR_B: 'from-r2' };
        },
      });

      const composite = defineCompositeResolver({
        resolvers: [resolver1, resolver2],
      });

      // Call with only env - resolver1 should be called, resolver2 should be skipped
      await expect(composite.resolve(['VAR_A', 'VAR_B'], { env: 'dev' })).rejects.toThrow(
        '[composite-resolver] Failed to resolve keys [VAR_B]'
      );

      expect(resolver1Called).toBe(true);
      // resolver2 is skipped because context doesn't have 'region'
      expect(resolver2Called).toBe(false);
    });
  });
});

// =============================================================================
// createStaticEnvResolver Tests
// =============================================================================

describe('createStaticEnvResolver', () => {
  it('resolves static values', async () => {
    const resolver = createStaticEnvResolver({
      vars: {
        API_URL: 'https://api.example.com',
        TIMEOUT: '5000',
      },
    });

    const result = await resolver.resolve(['API_URL', 'TIMEOUT'], {});
    expect(result).toEqual({
      API_URL: 'https://api.example.com',
      TIMEOUT: '5000',
    });
  });

  it('filters requested keys', async () => {
    const resolver = createStaticEnvResolver({
      vars: {
        VAR_A: 'a',
        VAR_B: 'b',
      },
    });

    const result = await resolver.resolve(['VAR_A'], {});
    expect(result).toEqual({ VAR_A: 'a' });
    expect(result).not.toHaveProperty('VAR_B');
  });

  it('exposes available vars', () => {
    const resolver = createStaticEnvResolver({
      vars: {
        VAR_A: 'a',
        VAR_B: 'b',
      },
    });

    expect(resolver.availableVars).toContain('VAR_A');
    expect(resolver.availableVars).toContain('VAR_B');
    expect(resolver.availableVars).toHaveLength(2);
  });

  it('validates context when provided', async () => {
    const resolver = createStaticEnvResolver({
      vars: { VAR: 'value' },
      requiredContext: z.object({
        env: z.enum(['dev', 'prod']),
      }),
    });

    // Valid context
    const result = await resolver.resolve(['VAR'], { env: 'dev' });
    expect(result).toEqual({ VAR: 'value' });

    // Invalid context
    expect(() => resolver.resolve(['VAR'], { env: 'invalid' })).toThrow();
  });
});
