#!/usr/bin/env bun
/**
 * @pokit/cmd - Global CLI launcher for pok
 *
 * This is a thin wrapper that:
 * 1. Tries to import @pokit/core from the current project
 * 2. Calls runCli() to handle the actual CLI logic
 * 3. Shows helpful error messages if requirements are not met
 *
 * Install globally with: bun add -g @pokit/cmd
 * Then run `pok` from any project with @pokit/core installed.
 */

async function main() {
  try {
    const { runCli } = await import('@pokit/core');
    await runCli(process.argv.slice(2));
  } catch (error) {
    // Check if it's a module resolution error
    if (
      error instanceof Error &&
      (error.message.includes('Cannot find') ||
        error.message.includes('could not resolve') ||
        error.message.includes('Module not found'))
    ) {
      console.error(
        'Error: @pokit/core is not installed in this project.\n\n' +
          'Requirements:\n' +
          '  - Bun runtime: https://bun.sh\n' +
          '  - @pokit/core installed in your project\n\n' +
          'Install with:\n' +
          '  bun add @pokit/core\n'
      );
      process.exit(1);
    }

    // Re-throw other errors
    throw error;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
