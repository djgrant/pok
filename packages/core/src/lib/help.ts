/**
 * Help text generation
 *
 * Generates help text from command definitions for --help flag support.
 * Auto-discovers flags, types, defaults, and pre-flight checks from
 * the command's context and pre configuration.
 */

import type { CommandConfig, CommandNode, ContextDef, ContextFieldDef } from './command';
import type { CheckConfig } from './check';
import type { SchemaInfo } from './args';
import { getSchemaInfo } from './args';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for generating help text
 */
export type HelpOptions = {
  /** Command path segments (e.g., ['db', 'migrate']) */
  commandPath: string[];
  /** The command configuration */
  command: CommandConfig;
  /** Child command nodes (for parent commands) */
  children?: CommandNode[];
  /** Application name (e.g., 'mycli') */
  appName: string;
};

/**
 * Options for generating root help text
 */
export type RootHelpOptions = {
  /** Application name */
  appName: string;
  /** Top-level command nodes */
  commands: CommandNode[];
  /** Optional application description */
  description?: string;
};

// =============================================================================
// Constants
// =============================================================================

/** Indentation for flag/command descriptions */
const INDENT = '  ';

/** Minimum padding between flag name and description */
const MIN_PADDING = 2;

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Convert camelCase to kebab-case for CLI flags
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Format a flag line for help output
 *
 * @example
 * formatFlagLine('env', { type: 'enum', choices: ['dev', 'prod'], isOptional: false })
 * // Returns: "--env <dev|prod>          Target environment (required)"
 */
export function formatFlagLine(
  name: string,
  fieldDef: ContextFieldDef,
  info: SchemaInfo,
  maxFlagWidth: number
): string {
  const kebabName = camelToKebab(name);
  let flagPart = `--${kebabName}`;

  // Add value placeholder based on type
  if (info.type === 'enum' && info.choices) {
    flagPart += ` <${info.choices.join('|')}>`;
  } else if (info.type === 'string') {
    flagPart += ' <string>';
  }
  // Boolean flags don't need a value placeholder

  // Build description with metadata
  let description = fieldDef.description || '';
  const meta: string[] = [];

  if (!info.isOptional) {
    meta.push('required');
  } else if (info.default !== undefined) {
    meta.push(`default: ${String(info.default)}`);
  }

  if (meta.length > 0) {
    description += description ? ` (${meta.join(', ')})` : `(${meta.join(', ')})`;
  }

  // Pad flag part to align descriptions
  const padding = Math.max(MIN_PADDING, maxFlagWidth - flagPart.length + MIN_PADDING);

  return `${INDENT}${flagPart}${' '.repeat(padding)}${description}`;
}

/**
 * Format a subcommand line for help output
 */
function formatCommandLine(node: CommandNode, maxNameWidth: number): string {
  const padding = Math.max(MIN_PADDING, maxNameWidth - node.segment.length + MIN_PADDING);
  return `${INDENT}${node.segment}${' '.repeat(padding)}${node.config.label}`;
}

/**
 * Calculate the maximum width needed for flag names
 */
function getMaxFlagWidth(contextDef: ContextDef): number {
  let max = 0;

  for (const [name, fieldDef] of Object.entries(contextDef)) {
    const info = getSchemaInfo(fieldDef.schema);
    const kebabName = camelToKebab(name);
    let width = `--${kebabName}`.length;

    if (info.type === 'enum' && info.choices) {
      width += ` <${info.choices.join('|')}>`.length;
    } else if (info.type === 'string') {
      width += ' <string>'.length;
    }

    max = Math.max(max, width);
  }

  // Account for built-in --help flag
  max = Math.max(max, '-h, --help'.length);

  return max;
}

/**
 * Get the maximum width needed for command names
 */
function getMaxCommandWidth(nodes: CommandNode[]): number {
  return Math.max(...nodes.map((n) => n.segment.length), 0);
}

// =============================================================================
// Pre-flight Check Extraction
// =============================================================================

/**
 * Extract static pre-flight check labels from a command config.
 * Only works for static check configurations (not dynamic HookFn).
 */
function getStaticPreCheckLabels(config: CommandConfig): string[] {
  const pre = config.pre;
  if (!pre) return [];

  // If it's a function, we can't statically determine the checks
  if (typeof pre === 'function') return [];

  const checks = Array.isArray(pre) ? pre : [pre];
  return checks.filter((c): c is CheckConfig => c !== null && c !== undefined).map((c) => c.label);
}

// =============================================================================
// Help Generators
// =============================================================================

/**
 * Generate help text for a specific command
 */
export function generateHelp(options: HelpOptions): string {
  const { commandPath, command, children, appName } = options;
  const lines: string[] = [];

  // Title (command label)
  lines.push('');
  lines.push(command.label);
  lines.push('');

  // Usage line
  const fullPath = [appName, ...commandPath].join(' ');
  if (children && children.length > 0) {
    lines.push('Usage:');
    lines.push(`${INDENT}${fullPath} <command>`);
  } else if (command.context && Object.keys(command.context).length > 0) {
    lines.push('Usage:');
    lines.push(`${INDENT}${fullPath} [flags]`);
  } else {
    lines.push('Usage:');
    lines.push(`${INDENT}${fullPath}`);
  }

  // Available Commands (for parent commands)
  if (children && children.length > 0) {
    lines.push('');
    lines.push('Available Commands:');

    const sortedChildren = [...children].sort((a, b) => a.segment.localeCompare(b.segment));
    const maxWidth = getMaxCommandWidth(sortedChildren);

    for (const child of sortedChildren) {
      lines.push(formatCommandLine(child, maxWidth));
    }
  }

  // Flags section
  const contextDef = command.context;
  if (contextDef && Object.keys(contextDef).length > 0) {
    lines.push('');
    lines.push('Flags:');

    const maxWidth = getMaxFlagWidth(contextDef);

    // Sort flags alphabetically
    const sortedFlags = Object.entries(contextDef).sort(([a], [b]) => a.localeCompare(b));

    for (const [name, fieldDef] of sortedFlags) {
      const info = getSchemaInfo(fieldDef.schema);
      lines.push(formatFlagLine(name, fieldDef, info, maxWidth));
    }

    // Add help flag
    const helpPadding = Math.max(MIN_PADDING, maxWidth - '-h, --help'.length + MIN_PADDING);
    lines.push(`${INDENT}-h, --help${' '.repeat(helpPadding)}Show this help message`);
  } else {
    // Even without context, show the help flag
    lines.push('');
    lines.push('Flags:');
    lines.push(`${INDENT}-h, --help    Show this help message`);
  }

  // Pre-flight checks section
  const preCheckLabels = getStaticPreCheckLabels(command);
  if (preCheckLabels.length > 0) {
    lines.push('');
    lines.push('Pre-flight checks:');
    for (const label of preCheckLabels) {
      lines.push(`${INDENT}- ${label}`);
    }
  }

  // Footer hint for parent commands
  if (children && children.length > 0) {
    lines.push('');
    lines.push(`Use "${fullPath} <command> --help" for more information about a command.`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Generate root-level help text showing all top-level commands
 */
export function generateRootHelp(options: RootHelpOptions): string {
  const { appName, commands, description } = options;
  const lines: string[] = [];

  // Title
  lines.push('');
  if (description) {
    lines.push(`${appName} - ${description}`);
  } else {
    lines.push(appName);
  }
  lines.push('');

  // Usage
  lines.push('Usage:');
  lines.push(`${INDENT}${appName} <command> [flags]`);
  lines.push('');

  // Available Commands
  lines.push('Available Commands:');

  const sortedCommands = [...commands].sort((a, b) => a.segment.localeCompare(b.segment));
  const maxWidth = getMaxCommandWidth(sortedCommands);

  for (const cmd of sortedCommands) {
    lines.push(formatCommandLine(cmd, maxWidth));
  }

  // Global flags
  lines.push('');
  lines.push('Flags:');
  lines.push(`${INDENT}-h, --help     Show this help message`);
  lines.push(`${INDENT}--version      Show version information`);

  // Footer
  lines.push('');
  lines.push(`Use "${appName} <command> --help" for more information about a command.`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Check if args contain help flag
 */
export function hasHelpFlag(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}
