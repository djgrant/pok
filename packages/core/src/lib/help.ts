/**
 * Help text generation
 *
 * Generates help text from command definitions for --help flag support.
 * Auto-discovers flags, types, defaults, and pre-flight checks from
 * the command's context and pre configuration.
 */

import type { CommandConfig, CommandNode, CommandTree, ContextDef, ContextFieldDef } from './command';
import { isContextFieldDef } from './command';
import type { CheckConfig } from './check';
import type { SchemaInfo } from './args';
import { getSchemaInfo } from './args';
import { camelToKebab } from './string-case';

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
  /** Optional app-level global flags */
  globalContext?: ContextDef;
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

function normalizeAlias(alias: string): string {
  return alias.replace(/^--/, '').trim();
}

function getFlagNames(name: string, fieldDef: ContextFieldDef): string[] {
  const primary = camelToKebab(name);
  const seen = new Set([primary]);
  const names = [primary];

  for (const alias of fieldDef.aliases ?? []) {
    const normalized = camelToKebab(normalizeAlias(alias));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    names.push(normalized);
  }

  return names;
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
  const flagNames = getFlagNames(name, fieldDef);
  let flagPart = flagNames.map((flag) => `--${flag}`).join(', ');

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
 * Build the positional-argument portion of a usage line.
 *
 * @example `<query> [<extra>...]` for an `arg` + optional `args` pair.
 */
export function getPositionalUsage(contextDef: ContextDef | undefined): string {
  if (!contextDef) return '';
  const parts: string[] = [];
  for (const [name, fieldDef] of Object.entries(contextDef)) {
    if (!isContextFieldDef(fieldDef)) continue;
    if (fieldDef.from !== 'arg' && fieldDef.from !== 'args') continue;
    const info = getSchemaInfo(fieldDef.schema);
    const kebab = name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    const token = fieldDef.from === 'args' ? `<${kebab}...>` : `<${kebab}>`;
    parts.push(info.isOptional ? `[${token}]` : token);
  }
  return parts.join(' ');
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
    // Skip static values and positional fields (only flags appear here)
    if (!isContextFieldDef(fieldDef) || fieldDef.from !== 'flag') {
      continue;
    }

    const info = getSchemaInfo(fieldDef.schema);
    const flagNames = getFlagNames(name, fieldDef);
    let width = flagNames.map((flag) => `--${flag}`).join(', ').length;

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

  // Long description (if any)
  if (command.description) {
    lines.push(command.description);
    lines.push('');
  }

  // Aliases (if any)
  if (command.aliases && command.aliases.length > 0) {
    lines.push(`Aliases: ${command.aliases.join(', ')}`);
    lines.push('');
  }

  // Usage line
  const fullPath = [appName, ...commandPath].join(' ');
  const positionalUsage = getPositionalUsage(command.context);
  const hasFlagFields = command.context
    ? Object.entries(command.context).some(
        ([, f]) => isContextFieldDef(f) && f.from === 'flag'
      )
    : false;
  if (children && children.length > 0) {
    lines.push('Usage:');
    lines.push(`${INDENT}${fullPath} <command>`);
  } else if (command.context && Object.keys(command.context).length > 0) {
    const parts = [fullPath, positionalUsage, hasFlagFields ? '[flags]' : '']
      .filter(Boolean)
      .join(' ');
    lines.push('Usage:');
    lines.push(`${INDENT}${parts}`);
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

  // Arguments section (positional fields, in declaration order)
  const contextDef = command.context;
  if (contextDef) {
    const positionals = Object.entries(contextDef).filter(
      ([, f]) => isContextFieldDef(f) && (f.from === 'arg' || f.from === 'args')
    );
    if (positionals.length > 0) {
      lines.push('');
      lines.push('Arguments:');
      const maxTokenWidth = Math.max(
        ...positionals.map(([name, f]) => {
          const kebab = name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
          return (f as ContextFieldDef).from === 'args'
            ? `<${kebab}...>`.length
            : `<${kebab}>`.length;
        })
      );
      for (const [name, fieldDef] of positionals) {
        const fd = fieldDef as ContextFieldDef;
        const info = getSchemaInfo(fd.schema);
        const kebab = name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        const token = fd.from === 'args' ? `<${kebab}...>` : `<${kebab}>`;
        let desc = fd.description || '';
        const hasShowableDefault =
          info.default !== undefined && !(Array.isArray(info.default) && info.default.length === 0);
        const meta = !info.isOptional
          ? 'required'
          : hasShowableDefault
            ? `default: ${String(info.default)}`
            : '';
        if (meta) desc += desc ? ` (${meta})` : `(${meta})`;
        const padding = Math.max(MIN_PADDING, maxTokenWidth - token.length + MIN_PADDING);
        lines.push(`${INDENT}${token}${' '.repeat(padding)}${desc}`);
      }
    }
  }

  // Flags section (only true flag fields)
  const flagEntries = contextDef
    ? Object.entries(contextDef).filter(([, f]) => isContextFieldDef(f) && f.from === 'flag')
    : [];
  if (flagEntries.length > 0) {
    lines.push('');
    lines.push('Flags:');

    const maxWidth = getMaxFlagWidth(contextDef!);

    // Sort flags alphabetically
    const sortedFlags = [...flagEntries].sort(([a], [b]) => a.localeCompare(b));
    for (const [name, fieldDef] of sortedFlags) {
      const info = getSchemaInfo((fieldDef as ContextFieldDef).schema);
      lines.push(formatFlagLine(name, fieldDef as ContextFieldDef, info, maxWidth));
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

  // Examples section
  if (command.examples && command.examples.length > 0) {
    lines.push('');
    lines.push('Examples:');
    for (const example of command.examples) {
      lines.push(`${INDENT}${example}`);
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
  const { appName, commands, description, globalContext } = options;
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
  if (globalContext && Object.keys(globalContext).length > 0) {
    const maxWidth = Math.max(
      '--version'.length,
      getMaxFlagWidth(globalContext)
    );
    const basePadding = Math.max(MIN_PADDING, maxWidth - '-h, --help'.length + MIN_PADDING);
    const versionPadding = Math.max(MIN_PADDING, maxWidth - '--version'.length + MIN_PADDING);
    lines[lines.length - 2] = `${INDENT}-h, --help${' '.repeat(basePadding)}Show this help message`;
    lines[lines.length - 1] = `${INDENT}--version${' '.repeat(versionPadding)}Show version information`;

    const sortedFlags = Object.entries(globalContext).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, fieldDef] of sortedFlags) {
      if (!isContextFieldDef(fieldDef)) {
        continue;
      }
      lines.push(formatFlagLine(name, fieldDef, getSchemaInfo(fieldDef.schema), maxWidth));
    }
  }

  // Footer
  lines.push('');
  lines.push(`Use "${appName} <command> --help" for more information about a command.`);
  lines.push('');

  return lines.join('\n');
}

// =============================================================================
// Recursive Help (full CLI reference)
// =============================================================================

/**
 * Options for generating recursive help text
 */
export type RecursiveHelpOptions = {
  /** Application name */
  appName: string;
  /** Root command tree */
  tree: CommandTree;
  /** Optional subtree root node (for `help <command>`) */
  subtree?: CommandNode;
  /** Optional app-level global flags */
  globalContext?: ContextDef;
};

/**
 * Generate recursive help for a single node and all its descendants
 */
function generateNodeHelp(
  node: CommandNode,
  appName: string,
  lines: string[]
): void {
  const fullPath = [appName, ...node.path].join(' ');
  const children = Array.from(node.children.values());

  // Command heading
  lines.push(`## ${fullPath}`);
  lines.push('');
  lines.push(node.config.label);
  lines.push('');

  if (node.config.description) {
    lines.push(node.config.description);
    lines.push('');
  }

  // Aliases
  if (node.config.aliases && node.config.aliases.length > 0) {
    lines.push(`Aliases: ${node.config.aliases.join(', ')}`);
    lines.push('');
  }

  // Usage
  if (children.length > 0) {
    lines.push(`Usage: ${fullPath} <command> [flags]`);
  } else if (node.config.context && Object.keys(node.config.context).length > 0) {
    lines.push(`Usage: ${fullPath} [flags]`);
  } else {
    lines.push(`Usage: ${fullPath}`);
  }
  lines.push('');

  // Subcommands list
  if (children.length > 0) {
    lines.push('Subcommands:');
    const sorted = [...children].sort((a, b) => a.segment.localeCompare(b.segment));
    for (const child of sorted) {
      lines.push(`${INDENT}${child.segment}  ${child.config.label}`);
    }
    lines.push('');
  }

  // Flags
  const contextDef = node.config.context;
  if (contextDef && Object.keys(contextDef).length > 0) {
    lines.push('Flags:');
    const maxWidth = getMaxFlagWidth(contextDef);
    const sortedFlags = Object.entries(contextDef).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, fieldDef] of sortedFlags) {
      if (!isContextFieldDef(fieldDef)) continue;
      const info = getSchemaInfo(fieldDef.schema);
      lines.push(formatFlagLine(name, fieldDef, info, maxWidth));
    }
    lines.push('');
  }

  // Examples
  if (node.config.examples && node.config.examples.length > 0) {
    lines.push('Examples:');
    for (const example of node.config.examples) {
      lines.push(`${INDENT}${example}`);
    }
    lines.push('');
  }

  // Recurse into children
  if (children.length > 0) {
    const sorted = [...children].sort((a, b) => a.segment.localeCompare(b.segment));
    for (const child of sorted) {
      generateNodeHelp(child, appName, lines);
    }
  }
}

/**
 * Generate comprehensive recursive help for the entire CLI or a subtree.
 *
 * Produces a full reference document showing every command, its flags,
 * and subcommands. Designed to be consumed in a single read by agents
 * or piped to a pager.
 */
export function generateRecursiveHelp(options: RecursiveHelpOptions): string {
  const { appName, tree, subtree, globalContext } = options;
  const lines: string[] = [];

  if (subtree) {
    // Show recursive help for a specific subtree
    generateNodeHelp(subtree, appName, lines);
    return lines.join('\n');
  }

  // Full CLI reference
  lines.push(`# ${appName} — CLI Reference`);
  lines.push('');

  // Global flags
  if (globalContext && Object.keys(globalContext).length > 0) {
    lines.push('## Global Flags');
    lines.push('');
    const maxWidth = getMaxFlagWidth(globalContext);
    const sortedFlags = Object.entries(globalContext).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, fieldDef] of sortedFlags) {
      if (!isContextFieldDef(fieldDef)) continue;
      const info = getSchemaInfo(fieldDef.schema);
      lines.push(formatFlagLine(name, fieldDef, info, maxWidth));
    }
    lines.push('');
  }

  // All commands
  const sorted = Array.from(tree.values()).sort((a, b) => a.segment.localeCompare(b.segment));
  for (const node of sorted) {
    generateNodeHelp(node, appName, lines);
  }

  return lines.join('\n');
}

/**
 * Check if args contain help flag
 */
export function hasHelpFlag(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}

/**
 * Check if args contain version flag
 */
export function hasVersionFlag(args: string[]): boolean {
  return args.includes('--version') || args.includes('-V');
}
