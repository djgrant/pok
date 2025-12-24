/**
 * Check definition
 *
 * Checks are validation functions that throw on failure.
 * Used in command `pre` hooks to validate preconditions.
 *
 * @example
 * ```ts
 * import { defineCheck } from '../lib/check';
 * import * as shell from '../utils/shell';
 *
 * export const dockerRunning = defineCheck({
 *   label: 'Docker running',
 *   check: async () => {
 *     const installed = await shell.commandExists('docker');
 *     if (!installed) {
 *       throw new Error('Docker is not installed.');
 *     }
 *     const running = await shell.isDockerRunning();
 *     if (!running) {
 *       throw new Error('Docker is not running.');
 *     }
 *   },
 * });
 * ```
 */

/**
 * Check function type - throws on failure
 */
export type CheckFn = () => Promise<void> | void;

/**
 * Check configuration
 */
export type CheckConfig = {
  /** Human-readable label for logging */
  label: string;
  /** Validation function - throws if check fails */
  check: CheckFn;
};

/**
 * Define a check with metadata
 *
 * Checks are used in command `pre` hooks to validate preconditions
 * before the command runs. They should throw an Error with a
 * user-friendly message if the check fails.
 *
 * @example
 * ```ts
 * // In checks/docker.ts
 * export const dockerRunning = defineCheck({
 *   label: 'Docker running',
 *   check: async () => {
 *     const running = await shell.isDockerRunning();
 *     if (!running) {
 *       throw new Error('Docker is not running. Please start Docker Desktop.');
 *     }
 *   },
 * });
 *
 * // In commands/dev.ts
 * export const command = defineCommand({
 *   pre: [dockerRunning],
 *   run: async (r) => { ... },
 * });
 * ```
 */
export function defineCheck(config: CheckConfig): CheckConfig {
  return config;
}
