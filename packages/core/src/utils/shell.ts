/**
 * Generic shell command utilities
 */
import { getRuntime } from '../runtime';

/**
 * Check if a command exists on the system
 */
export async function commandExists(cmd: string): Promise<boolean> {
  const runtime = await getRuntime();
  const result = await runtime.shell(`which ${cmd}`);
  return result.exitCode === 0;
}

/**
 * Get the version of a command (expects --version flag)
 */
export async function getVersion(cmd: string): Promise<string | null> {
  const runtime = await getRuntime();
  const result = await runtime.shell(`${cmd} --version`);
  if (result.exitCode !== 0) return null;
  return result.stdout.trim().split('\n')[0] ?? null;
}

/**
 * Get Node.js major version
 */
export async function getNodeMajorVersion(): Promise<number | null> {
  const runtime = await getRuntime();
  const result = await runtime.shell('node --version');
  if (result.exitCode !== 0) return null;
  const match = result.stdout.match(/v(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/**
 * Run a command and stream output to console
 */
export async function run(cmd: string, args: string[] = []): Promise<{ exitCode: number }> {
  const runtime = await getRuntime();
  const fullCmd =
    args.length > 0 ? `${cmd} ${args.map((a) => runtime.escapeShell(a)).join(' ')}` : cmd;
  const result = await runtime.shell(fullCmd);
  return { exitCode: result.exitCode };
}

/**
 * Run a command silently and return success/failure
 */
export async function runQuiet(cmd: string, args: string[] = []): Promise<boolean> {
  const runtime = await getRuntime();
  const fullCmd =
    args.length > 0 ? `${cmd} ${args.map((a) => runtime.escapeShell(a)).join(' ')}` : cmd;
  const result = await runtime.shell(fullCmd, { quiet: true });
  return result.exitCode === 0;
}

/**
 * Detect which package manager was used to invoke the CLI.
 * Falls back to 'npm' if detection fails.
 */
export function detectPackageManagerFromUserAgent(): 'npm' | 'pnpm' | 'yarn' | 'bun' {
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
