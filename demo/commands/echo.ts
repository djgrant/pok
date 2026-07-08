import { z } from 'zod';
import { wrapScript } from '@pokit/core';

// wrapScript: collapse the "parse args, then shell out" boilerplate to one
// declaration. Here we wrap `echo`, but in real use this is
// `['python3', script('read_emails.py'), 'show', query]`.
//
// - `words` is a variadic positional (from: 'args')
// - everything after `--` is passed straight through to the wrapped command
//
//   demo echo hello world        ->  echo hello world
//   demo echo hi -- -n           ->  echo hi -n     (passthrough flag)
export const command = wrapScript({
  label: 'Echo (wrapped subprocess)',
  description: 'wrapScript demo: positional args + `--` passthrough',
  context: {
    words: {
      from: 'args',
      schema: z.array(z.string()).default([]),
      description: 'Words to echo',
    },
  },
  argv: ({ words }) => ['echo', ...words],
});
