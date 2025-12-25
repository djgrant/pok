/**
 * Dry Run Pattern Support
 *
 * Provides utilities for implementing --dry-run mode in CLI commands.
 * Dry run mode shows what would happen without making actual changes.
 *
 * @example
 * ```ts
 * import { dryRunContext, createDryRunReporter } from '@openpok/core';
 *
 * export const command = defineCommand({
 *   label: 'Deploy to environment',
 *   context: {
 *     env: { from: 'flag', schema: z.enum(['staging', 'prod']) },
 *     ...dryRunContext,
 *   },
 *   run: async (r, ctx) => {
 *     const dry = createDryRunReporter(r.reporter);
 *
 *     if (ctx.context.dryRun) {
 *       dry.summary([
 *         'Build application',
 *         'Push to registry',
 *         'Update load balancer',
 *       ]);
 *       return;
 *     }
 *
 *     // Actual implementation...
 *   },
 * });
 * ```
 */

import { z } from 'zod';
import type { ContextFieldDef } from './command';
import type { CommandReporter } from '../events';

// =============================================================================
// Context Helper
// =============================================================================

/**
 * Standard dry-run context field definition.
 *
 * Spread this into your command's context to add --dry-run support.
 *
 * @example
 * ```ts
 * context: {
 *   env: { from: 'flag', schema: z.enum(['dev', 'prod']) },
 *   ...dryRunContext,
 * },
 * ```
 */
export const dryRunContext = {
  dryRun: {
    from: 'flag' as const,
    schema: z.boolean().default(false),
    description: 'Show what would be done without making changes',
  } satisfies ContextFieldDef,
};

// =============================================================================
// Type Helper
// =============================================================================

/**
 * Type helper for adding dry-run to existing context types.
 *
 * @example
 * ```ts
 * type MyContext = { env: string };
 * type MyContextWithDryRun = WithDryRun<MyContext>;
 * // { env: string; dryRun: boolean }
 * ```
 */
export type WithDryRun<C> = C & { dryRun: boolean };

// =============================================================================
// Dry Run Reporter
// =============================================================================

/**
 * Reporter interface for dry-run mode output.
 */
export type DryRunReporter = {
  /**
   * Report a single action that would be executed.
   *
   * @example
   * ```ts
   * dry.wouldExecute('Build application');
   * // Output: [DRY RUN] Would: Build application
   * ```
   */
  wouldExecute(action: string): void;

  /**
   * Report a shell command that would be executed.
   *
   * @example
   * ```ts
   * dry.wouldRun('npm run build');
   * // Output: [DRY RUN] Would run: npm run build
   * ```
   */
  wouldRun(command: string): void;

  /**
   * Report a summary of all planned actions.
   *
   * @example
   * ```ts
   * dry.summary([
   *   'Build application',
   *   'Push to registry',
   *   'Update load balancer',
   * ]);
   * // Output:
   * // [DRY RUN] Would execute:
   * //   - Build application
   * //   - Push to registry
   * //   - Update load balancer
   * //
   * // No changes were made.
   * ```
   */
  summary(actions: string[]): void;
};

/**
 * Create a dry-run reporter that wraps the command reporter.
 *
 * The dry-run reporter provides specialized methods for reporting
 * what would happen without making changes.
 *
 * @param reporter - The command reporter from the runner
 * @returns A dry-run reporter with specialized methods
 *
 * @example
 * ```ts
 * run: async (r, ctx) => {
 *   const dry = createDryRunReporter(r.reporter);
 *
 *   if (ctx.context.dryRun) {
 *     dry.wouldExecute('Build application');
 *     dry.wouldRun('docker push myapp:latest');
 *     return;
 *   }
 *
 *   // Actual implementation...
 * },
 * ```
 */
export function createDryRunReporter(reporter: CommandReporter): DryRunReporter {
  return {
    wouldExecute(action: string): void {
      reporter.step(`[DRY RUN] Would: ${action}`);
    },

    wouldRun(command: string): void {
      reporter.step(`[DRY RUN] Would run: ${command}`);
    },

    summary(actions: string[]): void {
      reporter.info('[DRY RUN] Would execute:');
      for (const action of actions) {
        reporter.step(`  - ${action}`);
      }
      reporter.info('');
      reporter.info('No changes were made.');
    },
  };
}
