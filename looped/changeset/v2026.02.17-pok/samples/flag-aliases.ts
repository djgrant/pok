import { z, defineCommand } from '@pokit/core'

export const command = defineCommand({
  label: 'Show one epic',
  context: {
    epicRef: {
      from: 'flag',
      schema: z.string(),
      aliases: ['id', 'slug'],
      description: 'Epic id or slug',
    },
  },
  run: async (_r, ctx) => {
    const epicRef = ctx.context.epicRef
    console.log(`Looking up epic: ${epicRef}`)
  },
})
