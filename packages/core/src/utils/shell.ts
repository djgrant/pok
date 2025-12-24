/**
 * Generic shell command utilities
 */
import { $ } from 'bun';

/**
 * Check if a command exists on the system
 */
export async function commandExists(cmd: string): Promise<boolean> {
  const result = await $`which ${cmd}`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Get the version of a command (expects --version flag)
 */
export async function getVersion(cmd: string): Promise<string | null> {
  const result = await $`${cmd} --version`.nothrow().quiet();
  if (result.exitCode !== 0) return null;
  return result.text().trim().split('\n')[0] ?? null;
}

/**
 * Get Node.js major version
 */
export async function getNodeMajorVersion(): Promise<number | null> {
  const result = await $`node --version`.nothrow().quiet();
  if (result.exitCode !== 0) return null;
  const match = result.text().match(/v(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/**
 * Run a command and stream output to console
 */
export async function run(cmd: string, args: string[] = []): Promise<{ exitCode: number }> {
  const result = await $`${cmd} ${args}`.nothrow();
  return { exitCode: result.exitCode };
}

/**
 * Run a command silently and return success/failure
 */
export async function runQuiet(cmd: string, args: string[] = []): Promise<boolean> {
  const result = await $`${cmd} ${args}`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Detect which package manager was used to invoke the CLI.
 * Falls back to 'npm' if detection fails.
 */
export function getPackageManager(): 'npm' | 'pnpm' | 'yarn' | 'bun' {
  // Check npm_config_user_agent which is set by package managers
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    if (userAgent.startsWith('pnpm/')) return 'pnpm';
    if (userAgent.startsWith('yarn/')) return 'yarn';
    if (userAgent.startsWith('bun/')) return 'bun';
    if (userAgent.startsWith('npm/')) return 'npm';
  }

  // Fallback to npm as the generic default
  return 'npm';
}
