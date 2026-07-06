import { z } from 'zod';
import { defineCommand, defineEnv, defineEnvResolver, defineTask } from '@pokit/core';

// Fake resolver: no real secrets, no network. Values are deterministic
// per-environment so the demo output is stable and obviously fake.
const fakeResolver = defineEnvResolver({
  requiredContext: z.object({ env: z.enum(['dev', 'prod']) }),
  availableVars: ['POSTGRES_URL', 'API_KEY'] as const,
  resolve: (keys, ctx) => {
    const values: Record<string, string> = {
      POSTGRES_URL: `postgres://fake-${ctx.env}-db:5432/app`,
      API_KEY: `fake-${ctx.env}-api-key-00000000`,
    };
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = values[key];
    }
    return result;
  },
});

const secretsEnv = defineEnv({
  resolver: fakeResolver,
  vars: ['POSTGRES_URL', 'API_KEY'],
});

const printSecrets = defineTask({
  label: 'Print resolved secrets',
  env: secretsEnv,
  run: async (_r, { envs, reporter }) => {
    for (const [key, value] of Object.entries(envs)) {
      const preview = value.length > 12 ? `${value.slice(0, 12)}…` : value;
      reporter.info(`${key}: ${preview}`);
    }
  },
});

// Exercises the env/resolver system: `pok secrets --env prod` resolves
// POSTGRES_URL + API_KEY via a fake resolver and prints a redacted preview.
// If `pokd` (the trust broker daemon) is running, resolution is routed
// through it and triggers a Touch ID prompt; otherwise it resolves directly.
export const command = defineCommand({
  label: 'Secrets demo',
  description: 'Resolve fake env vars via a resolver (--env dev|prod)',
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'prod']).default('dev'),
      description: 'Target environment',
    },
  },
  run: async (r) => {
    await r.run(printSecrets);
  },
});
