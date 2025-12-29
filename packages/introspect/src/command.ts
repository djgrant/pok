/**
 * defineCommand wrapper for pok introspect.
 */

import { defineCommand } from '@openpok/core';
import { z } from 'zod';
import { runIntrospect } from './introspect';

export const command = defineCommand({
  label: 'View files in a directory with live updates',
  context: {
    path: {
      from: 'flag',
      schema: z.string().optional().describe('Directory to watch'),
    },
    depth: {
      from: 'flag',
      schema: z.coerce.number().optional().default(3).describe('Maximum depth for file tree'),
    },
  },
  run: async (_r, ctx) => {
    await runIntrospect({
      path: ctx.context.path,
      depth: ctx.context.depth,
    });
  },
});
