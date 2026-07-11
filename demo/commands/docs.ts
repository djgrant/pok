import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { defineCommand } from '@pokit/core';

// Render a markdown doc in the terminal via `reporter.markdown()`.
//
// The reporter emits a `markdown` event; the active adapter renders it for its
// medium (@pokit/terminal -> ANSI, reporter-web -> HTML). No system deps, no
// `brew install` — the renderer ships with pok.
//
//   demo docs                 -> renders README.md
//   demo docs CHANGELOG.md    -> renders the given file
//   demo docs | glow          -> raw markdown passthrough (not a styled TTY)
export const command = defineCommand({
  label: 'Render a markdown doc in the terminal',
  description: 'Pretty-print a markdown file (defaults to README.md)',
  context: {
    file: {
      from: 'arg',
      schema: z.string().default('README.md'),
      description: 'Path to the markdown file',
    },
  },
  run: async (r, { context }) => {
    const content = await readFile(context.file, 'utf8');
    r.reporter.markdown(content);
  },
});
