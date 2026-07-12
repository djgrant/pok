import { z } from 'zod';
import { defineCommand } from '@pokit/core';
import { reconcilePostPublish } from './lib/post-publish';

export const command = defineCommand({
  label: 'Reconcile post-publish bookkeeping (idempotent)',
  context: {
    verdaccio: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Reconcile against local Verdaccio instead of npmjs',
    },
    skipPush: {
      from: 'flag',
      schema: z.boolean().optional(),
      description: 'Skip pushing the bookkeeping commit to remote',
    },
  },
  run: async (r, ctx) => {
    const registry = ctx.context.verdaccio
      ? process.env.VERDACCIO_REGISTRY || 'http://localhost:4873/'
      : 'https://registry.npmjs.org/';

    await reconcilePostPublish(r, {
      registry,
      skipPush: ctx.context.skipPush ?? false,
    });

    r.reporter.success('Post-publish bookkeeping reconciled.');
  },
});
