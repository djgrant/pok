import type { CheckConfig } from './check';
import { CheckError } from './check';
import type { CommandConfig, HookContext } from './command';
import type { Reporter } from '../events';

/**
 * Resolve checks from a command's pre configuration.
 *
 * Shared by the CLI router and the in-process SDK runtime so behavior matches.
 */
export async function resolveChecks(
  pre: CommandConfig['pre'],
  hookCtx: HookContext
): Promise<CheckConfig[]> {
  if (!pre) return [];

  if (typeof pre === 'function') {
    const result = await pre(hookCtx);
    if (!result) return [];
    if (Array.isArray(result)) return result.filter(Boolean) as CheckConfig[];
    return [result];
  }

  const preChecks = Array.isArray(pre) ? pre : [pre];
  return preChecks.filter(Boolean) as CheckConfig[];
}

/**
 * Execute a check and wrap any errors with remediation info from the check config.
 * This ensures that when checks fail, the failure includes remediation steps.
 */
export async function executeCheck(check: CheckConfig): Promise<void> {
  try {
    await check.check();
  } catch (originalError) {
    const remediation = check.remediation
      ? Array.isArray(check.remediation)
        ? check.remediation
        : [check.remediation]
      : undefined;

    const errorMessage =
      check.errorMessage ||
      (originalError instanceof Error ? originalError.message : String(originalError));

    throw new CheckError(errorMessage, {
      remediation,
      documentationUrl: check.documentationUrl,
    });
  }
}

/**
 * Run pre-checks for a command, grouped as "Pre-flight Checks".
 */
export async function runPreChecks(
  config: CommandConfig,
  hookContext: HookContext,
  reporter: Reporter
): Promise<void> {
  if (!config.pre) return;

  const checks = await resolveChecks(config.pre, hookContext);
  if (checks.length === 0) return;

  await reporter.group('Pre-flight Checks', { layout: 'sequence' }, async (groupReporter) => {
    for (const check of checks) {
      await groupReporter.activity(check.label, async () => {
        await executeCheck(check);
      });
    }
  });
}

/**
 * Run an array of pre-checks as a single "Pre-flight Checks" group.
 *
 * Used for batch execution scenarios where checks have already been collected.
 */
export async function runChecksGroup(checks: CheckConfig[], reporter: Reporter): Promise<void> {
  if (checks.length === 0) return;

  await reporter.group('Pre-flight Checks', { layout: 'sequence' }, async (groupReporter) => {
    for (const check of checks) {
      await groupReporter.activity(check.label, async () => {
        await executeCheck(check);
      });
    }
  });
}

