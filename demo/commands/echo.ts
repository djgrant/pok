import { z } from 'zod';
import { defineCommand } from '@pokit/core';

// Wrapping a subprocess is just defineCommand + r.exec with an argv array.
// Here we wrap `echo`, but in real use this is
// `['python3', script('read_emails.py'), 'show', query]`.
//
// - `words` is a variadic positional (from: 'args')
// - everything after `--` arrives in `extraArgs`; spread it into the argv array
//   to forward it straight to the wrapped command
//
//   demo echo hello world        ->  echo hello world
//   demo echo hi -- -n           ->  echo hi -n     (passthrough)
export const command = defineCommand({
  label: 'Echo (wrapped subprocess)',
  description: 'Wrapping a subprocess: positional args + `--` passthrough',
  context: {
    words: {
      from: 'args',
      schema: z.array(z.string()).default([]),
      description: 'Words to echo',
    },
  },
  // Array form: spawned directly, no shell, so dynamic values are not re-split.
  run: async (r, { context, extraArgs }) => {
    await r.exec(['echo', ...context.words, ...extraArgs]);
  },
});
