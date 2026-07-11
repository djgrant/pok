import { z } from 'zod';
import { defineCommand } from '@pokit/core';

// Positional args: `tag <name> [<extra>...]`.
// - `name` is a required single positional (from: 'arg')
// - `extra` is a variadic positional that soaks up the rest (from: 'args')
// - `--upper` remains an ordinary flag and can appear anywhere
//
//   demo tag release v1 v2 --upper   ->  primary=RELEASE, extra=[V1, V2]
export const command = defineCommand({
  label: 'Tag something',
  description: "Positional args: <name> [<extra>...], plus --upper",
  context: {
    name: {
      from: 'arg',
      schema: z.string().min(1),
      description: 'Primary tag',
    },
    extra: {
      from: 'args',
      schema: z.array(z.string()).default([]),
      description: 'Additional tags',
    },
    upper: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Uppercase the tags',
    },
  },
  run: async (r, { context }) => {
    const all = [context.name, ...context.extra];
    const shaped = context.upper ? all.map((t) => t.toUpperCase()) : all;
    await r.exec(`echo ${JSON.stringify('Tags: ' + shaped.join(', '))}`);
  },
});
