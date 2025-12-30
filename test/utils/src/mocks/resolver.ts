import { z } from 'zod';
import { defineEnvResolver } from '@pokjs/core';

export const mockResolver = defineEnvResolver({
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
  }),
  availableVars: ['API_KEY', 'DATABASE_URL', 'SECRET_TOKEN'] as const,
  resolve: (keys, ctx) => {
    return Object.fromEntries(keys.map((k) => [k, `mock-${k.toLowerCase()}-${ctx.env}`]));
  },
});

export const simpleResolver = defineEnvResolver({
  requiredContext: z.object({}),
  availableVars: ['SIMPLE_VAR', 'ANOTHER_VAR'] as const,
  resolve: (keys) => {
    return Object.fromEntries(keys.map((k) => [k, `simple-${k.toLowerCase()}`]));
  },
});
