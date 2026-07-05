import { z } from 'zod';
import { defineCommand } from '@pokit/core';

// Typed context / flags: `--name`, `--times`, `--loud`.
// Exercises schema coercion, defaults, and prompting for missing values.
export const command = defineCommand({
  label: 'Greet someone',
  description: 'Typed flags: --name, --times, --loud',
  context: {
    name: {
      from: 'flag',
      schema: z.string().min(1).default('world'),
      description: 'Who to greet',
    },
    times: {
      from: 'flag',
      schema: z.coerce.number().int().min(1).max(5).default(1),
      description: 'How many times to greet',
    },
    loud: {
      from: 'flag',
      schema: z.boolean().default(false),
      description: 'Shout the greeting',
    },
  },
  run: async (r, { context }) => {
    const base = `Hello, ${context.name}!`;
    const message = context.loud ? base.toUpperCase() : base;
    for (let i = 0; i < context.times; i++) {
      await r.exec(`echo ${JSON.stringify(message)}`);
    }
  },
});
