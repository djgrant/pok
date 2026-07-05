/**
 * CLI Error with usage context
 *
 * Custom error class that carries command context for rich error formatting.
 * When errors occur, this enables showing:
 * 1. The error message
 * 2. A usage line for quick reference
 * 3. A hint to use --help for more information
 */

import type { ContextDef } from './command';
import { isContextFieldDef } from './command';
import { getSchemaInfo } from './args';
import { camelToKebab } from './string-case';
import { markOperational } from './errors';

// =============================================================================
// Types
// =============================================================================

/**
 * Context for error formatting
 */
export type ErrorContext = {
  /** Application name (e.g., 'mycli') */
  appName: string;
  /** Command path segments (e.g., ['deploy', 'staging']) */
  commandPath: string[];
  /** Context definition for generating usage line */
  contextDef?: ContextDef;
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build the `--flag <...>` parts for a usage line from a context definition.
 */
function buildUsageFlagParts(contextDef: ContextDef): string[] {
  const parts: string[] = [];

  for (const [name, def] of Object.entries(contextDef)) {
    if (!isContextFieldDef(def)) continue;

    const info = getSchemaInfo(def.schema);
    const kebabName = camelToKebab(name);

    if (info.type === 'enum' && info.choices) {
      // Show choices for enum flags
      const choicesStr = info.choices.join('|');
      parts.push(
        info.isOptional ? `[--${kebabName} <${choicesStr}>]` : `--${kebabName} <${choicesStr}>`
      );
    } else if (info.type === 'boolean') {
      // Boolean flags are always optional in usage display
      parts.push(`[--${kebabName}]`);
    } else {
      // String flags show <value> placeholder
      parts.push(info.isOptional ? `[--${kebabName} <value>]` : `--${kebabName} <value>`);
    }
  }

  return parts;
}

// =============================================================================
// CLIError Class
// =============================================================================

/**
 * CLI Error with command context for rich error formatting.
 *
 * @example
 * ```ts
 * throw new CLIError('Required flag --env is missing', {
 *   appName: 'mycli',
 *   commandPath: ['deploy'],
 *   contextDef: { env: { from: 'flag', schema: z.enum(['dev', 'prod']) } },
 * });
 * ```
 *
 * When formatted, produces:
 * ```
 * Error: Required flag --env is missing
 *
 * Usage: mycli deploy --env <dev|prod>
 *
 * Run 'mycli deploy --help' for more information.
 * ```
 */
export class CLIError extends Error {
  readonly context: ErrorContext;

  constructor(message: string, context: ErrorContext) {
    super(message);
    this.name = 'CLIError';
    this.context = context;
    markOperational(this);
  }

  /**
   * Format the error with usage hints
   */
  format(): string {
    const lines: string[] = [`Error: ${this.message}`, ''];

    // Add usage line if context is available
    if (this.context.contextDef && Object.keys(this.context.contextDef).length > 0) {
      lines.push(`Usage: ${this.formatUsage()}`);
      lines.push('');
    }

    // Add help hint
    const cmd = [this.context.appName, ...this.context.commandPath].join(' ');
    lines.push(`Run '${cmd} --help' for more information.`);

    return lines.join('\n');
  }

  /**
   * Format the usage line with command path and flags
   */
  private formatUsage(): string {
    const cmd = [this.context.appName, ...this.context.commandPath].join(' ');
    const flags = this.formatFlags();
    return `${cmd}${flags ? ' ' + flags : ''}`;
  }

  /**
   * Format flags for the usage line
   */
  private formatFlags(): string {
    if (!this.context.contextDef) return '';
    return buildUsageFlagParts(this.context.contextDef).join(' ');
  }
}

/**
 * Generate a compact usage line for a command
 *
 * @example
 * ```ts
 * generateUsageLine('mycli', ['deploy'], { env: { from: 'flag', schema: z.enum(['dev', 'prod']) } })
 * // Returns: "mycli deploy --env <dev|prod>"
 * ```
 */
export function generateUsageLine(
  appName: string,
  commandPath: string[],
  contextDef: ContextDef
): string {
  const cmd = [appName, ...commandPath].join(' ');
  const flags = buildUsageFlagParts(contextDef);

  return flags.length > 0 ? `${cmd} ${flags.join(' ')}` : cmd;
}
