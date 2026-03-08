import { describe, expect, it } from 'bun:test'
import path from 'node:path'

describe('@pokit/core dist Node ESM compatibility', () => {
  it('loads the built package entrypoint with Node', async () => {
    const packageRoot = path.resolve(import.meta.dir, '..')
    const process = Bun.spawn(
      ['node', '--input-type=module', '--eval', "await import('./dist/index.js')"],
      {
        cwd: packageRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const exitCode = await process.exited
    const stderr = await new Response(process.stderr).text()

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
  })
})
