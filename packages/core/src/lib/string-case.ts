/**
 * Shared string case-conversion helpers for CLI flag handling.
 */

/**
 * Convert camelCase to kebab-case for CLI flags
 *
 * @example
 * camelToKebab('dryRun') // 'dry-run'
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 *
 * @example
 * kebabToCamel('dry-run') // 'dryRun'
 * kebabToCamel('no-git-checks') // 'noGitChecks'
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
