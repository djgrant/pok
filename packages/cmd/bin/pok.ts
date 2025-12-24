#!/usr/bin/env bun
/**
 * @openpok/cmd - Global CLI launcher for pok
 *
 * This is a thin wrapper that:
 * 1. Tries to import @openpok/core from the current project
 * 2. Calls runCli() to handle the actual CLI logic
 * 3. Shows helpful error messages if requirements are not met
 *
 * Install globally with: bun add -g @openpok/cmd
 * Then run `pok` from any project with @openpok/core installed.
 */

async function main() {
  try {
    const { runCli } = await import('@openpok/core');
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
        'Error: @openpok/core is not installed in this project.\n\n' +
          'Requirements:\n' +
          '  - Bun runtime: https://bun.sh\n' +
          '  - @openpok/core installed in your project\n\n' +
          'Install with:\n' +
          '  bun add @openpok/core\n'
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
