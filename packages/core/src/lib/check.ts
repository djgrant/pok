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
 *
 * @example With remediation
 * ```ts
 * export const dockerRunning = defineCheck({
 *   label: 'Docker running',
 *   check: async () => {
 *     const running = await shell.isDockerRunning();
 *     if (!running) {
 *       throw new Error('Docker is not running');
 *     }
 *   },
 *   errorMessage: 'Docker daemon is not running',
 *   remediation: [
 *     "Start Docker Desktop, or",
 *     "Run 'sudo systemctl start docker' (Linux)",
 *   ],
 *   documentationUrl: 'https://docs.docker.com/get-started/',
 * });
 * ```
 */

/**
 * Check function type - throws on failure
 */
export type CheckFn = () => Promise<void> | void;

/**
 * Error thrown when a check fails, with optional remediation info.
 * This error type carries remediation metadata that can be displayed
 * to help users fix the issue.
 */
export class CheckError extends Error {
  /** Remediation steps to fix the issue */
  readonly remediation?: string[];
  /** Documentation URL for more information */
  readonly documentationUrl?: string;

  constructor(
    message: string,
    options?: {
      remediation?: string[];
      documentationUrl?: string;
    }
  ) {
    super(message);
    this.name = 'CheckError';
    this.remediation = options?.remediation;
    this.documentationUrl = options?.documentationUrl;
  }
}

/**
 * Check configuration
 */
export type CheckConfig = {
  /** Human-readable label for logging */
  label: string;
  /** Validation function - throws if check fails */
  check: CheckFn;
  /** Custom error message (replaces default "Check failed" message) */
  errorMessage?: string;
  /** Remediation instructions - fix steps shown when check fails */
  remediation?: string | string[];
  /** Documentation URL for more information */
  documentationUrl?: string;
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
