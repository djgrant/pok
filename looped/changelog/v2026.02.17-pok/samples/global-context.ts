import { z } from 'zod'
import { runCli } from '@pokit/core'
import { createPrompter } from '@pokit/prompter-clack'
import { createReporterAdapter } from '@pokit/reporter-clack'

await runCli(process.argv.slice(2), {
  projectRoot: process.cwd(),
  commandsDir: `${process.cwd()}/commands`,
  appName: 'example-cli',
  reporterAdapter: createReporterAdapter(),
  prompter: createPrompter(),
  globalContext: {
    dir: {
      from: 'flag',
      schema: z.string().optional(),
      description: 'Working directory override',
    },
  },
  onGlobalContext: (ctx) => {
    if (typeof ctx.dir === 'string' && ctx.dir.trim()) {
      process.env.APP_DIR_OVERRIDE = ctx.dir
    }
  },
})
