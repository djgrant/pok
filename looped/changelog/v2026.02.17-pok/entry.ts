import { defineChangelogEntry } from '@notation/looped'

export default defineChangelogEntry({
  schema: 'changelog.entry',
  date: '2026-02-17',
  slug: 'pok',
  title: 'Global Flags and Aliases in Pok',
  summary: 'Added app-level global flags and first-class context flag aliases in pok.',
  packages: [
    {
      name: 'pok',
      changes: [
        'App-level global flags via globalContext and onGlobalContext',
        'First-class flag aliases on context fields',
        'Updated help and shell completion to surface aliases',
      ],
    },
  ],
  tasks: [
    { ref: 'looped/TASK-017', title: 'Upstream pok: support global app-level flags without CLI pre-parsing', status: 'done' },
    { ref: 'looped/TASK-018', title: 'Upstream pok: add first-class flag aliases for context fields', status: 'done' },
  ],
  validation: [
    { scope: 'pok', description: 'Args, help, completion, and router behavior tests passing', passed: true },
  ],
  filesChanged: [
    'pok/packages/core/src/cli.ts',
    'pok/packages/core/src/lib/router.ts',
    'pok/packages/core/src/lib/args.ts',
    'pok/packages/core/src/lib/command.ts',
    'pok/packages/core/src/lib/help.ts',
    'pok/packages/core/src/lib/completion.ts',
  ],
})
