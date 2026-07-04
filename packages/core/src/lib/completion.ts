/**
 * Shell completion generation
 *
 * Generates completion scripts for bash, zsh, and fish shells.
 * Supports dynamic completions via a hidden __complete command.
 */

import type { CommandTree, CommandNode } from './command';
import { isContextFieldDef } from './command';
import { getSchemaInfo, extractEnumChoices } from './args';
import { camelToKebab, kebabToCamel } from './string-case';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported shell types for completion
 */
export type Shell = 'bash' | 'zsh' | 'fish' | 'powershell';

// =============================================================================
// Completion Script Generation
// =============================================================================

/**
 * Generate a completion script for the specified shell
 *
 * @param appName - The CLI application name
 * @param shell - The target shell (bash, zsh, or fish)
 * @returns Shell completion script as a string
 */
export function generateCompletionScript(appName: string, shell: Shell): string {
  switch (shell) {
    case 'bash':
      return generateBashCompletion(appName);
    case 'zsh':
      return generateZshCompletion(appName);
    case 'fish':
      return generateFishCompletion(appName);
    case 'powershell':
      return generatePowerShellCompletion(appName);
  }
}

/**
 * Generate bash completion script
 */
function generateBashCompletion(appName: string): string {
  // Sanitize app name for use as shell function name
  const funcName = appName.replace(/[^a-zA-Z0-9_]/g, '_');

  return `# ${appName} bash completion
_${funcName}_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local completions

  # Get completions from the CLI itself
  completions=$("${appName}" __complete "\${COMP_WORDS[@]:1}" 2>/dev/null)

  COMPREPLY=($(compgen -W "$completions" -- "$cur"))
}

complete -F _${funcName}_completions ${appName}`;
}

/**
 * Generate zsh completion script
 */
function generateZshCompletion(appName: string): string {
  // Sanitize app name for use as shell function name
  const funcName = appName.replace(/[^a-zA-Z0-9_]/g, '_');

  return `#compdef ${appName}

_${funcName}() {
  local completions
  completions=("\${(@f)$(${appName} __complete "\${words[@]:1}" 2>/dev/null)}")

  _describe 'command' completions
}

compdef _${funcName} ${appName}`;
}

/**
 * Generate fish completion script
 */
function generateFishCompletion(appName: string): string {
  return `# ${appName} fish completion
complete -c ${appName} -f -a "(${appName} __complete (commandline -opc | string sub -s 2) 2>/dev/null)"`;
}

/**
 * Generate PowerShell completion script
 */
function generatePowerShellCompletion(appName: string): string {
  return `# ${appName} PowerShell completion
Register-ArgumentCompleter -Native -CommandName ${appName} -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandElements = $commandAst.CommandElements
    $args = @()

    # Skip the command name itself, collect remaining arguments
    for ($i = 1; $i -lt $commandElements.Count; $i++) {
        $args += $commandElements[$i].ToString()
    }

    # Get completions from the CLI
    $completions = & ${appName} __complete @args 2>$null

    if ($completions) {
        $completions -split '\\n' | ForEach-Object {
            $completion = $_.Trim()
            if ($completion -and $completion.StartsWith($wordToComplete)) {
                [System.Management.Automation.CompletionResult]::new(
                    $completion,
                    $completion,
                    'ParameterValue',
                    $completion
                )
            }
        }
    }
}`;
}

// =============================================================================
// Dynamic Completion Logic
// =============================================================================

/**
 * Generate completions for the given arguments
 *
 * @param args - The command line arguments so far
 * @param tree - The command tree
 * @returns Array of completion suggestions
 */
export function generateCompletions(args: string[], tree: CommandTree): string[] {
  // Get the last argument being typed (may be empty string for new position)
  const lastArg = args[args.length - 1] ?? '';
  const prevArg = args.length >= 2 ? args[args.length - 2] : undefined;

  // For finding the current command, we use all args except the last one being typed
  // and filter out flags
  const argsForPath = args.slice(0, -1);
  const { node: currentNode } = findCurrentNode(argsForPath, tree);

  // Complete flag values (--flag <value>)
  // When last arg is empty and prev is a flag, complete flag values
  if (prevArg?.startsWith('--') && !prevArg.startsWith('--no-')) {
    const flagName = kebabToCamel(prevArg.slice(2));
    const choices = getChoicesForFlag(flagName, currentNode);
    if (choices && choices.length > 0) {
      return choices.filter((c) => c.startsWith(lastArg));
    }
    // No specific choices, return empty (let shell do default completion)
    return [];
  }

  // Complete flags (--<partial>)
  if (lastArg.startsWith('--')) {
    const partial = lastArg.slice(2);
    const flags = getFlagsForNode(currentNode);
    return flags.filter((f) => f.startsWith(partial)).map((f) => `--${f}`);
  }

  // Complete commands
  const availableCommands = getAvailableCommands(currentNode, tree);
  return availableCommands.filter((cmd) => cmd.startsWith(lastArg));
}

/**
 * Find a node in a tree level by name or alias.
 *
 * Exact name matches take precedence over alias matches.
 */
function findNodeByNameOrAlias(level: CommandTree, name: string): CommandNode | undefined {
  // First, try exact match by name
  const exactMatch = level.get(name);
  if (exactMatch) return exactMatch;

  // Then, try aliases
  for (const node of level.values()) {
    if (node.config.aliases?.includes(name)) {
      return node;
    }
  }

  return undefined;
}

/**
 * Find the current command node based on arguments
 */
function findCurrentNode(args: string[], tree: CommandTree): { node: CommandNode | null } {
  // Filter out flags and empty strings to get just command path
  const commandArgs = args.filter((arg) => arg !== '' && !arg.startsWith('-'));

  if (commandArgs.length === 0) {
    return { node: null };
  }

  let currentLevel = tree;
  let lastMatchedNode: CommandNode | null = null;

  for (const segment of commandArgs) {
    const node = findNodeByNameOrAlias(currentLevel, segment);
    if (!node) break;

    lastMatchedNode = node;
    currentLevel = node.children;
  }

  return {
    node: lastMatchedNode,
  };
}

/**
 * Get available commands at the current level (including aliases)
 */
function getAvailableCommands(currentNode: CommandNode | null, tree: CommandTree): string[] {
  const commands: string[] = [];

  if (currentNode === null) {
    // At root level - return top-level commands and their aliases
    for (const [name, node] of tree) {
      commands.push(name);
      if (node.config.aliases) {
        commands.push(...node.config.aliases);
      }
    }
    return commands;
  }

  // Add "all" option if enabled
  if (currentNode.config.enableRunAllChildren) {
    commands.push('all');
  }

  // Return children of current node and their aliases
  for (const [name, node] of currentNode.children) {
    commands.push(name);
    if (node.config.aliases) {
      commands.push(...node.config.aliases);
    }
  }

  return commands;
}

/**
 * Get all flags for a command node
 */
function getFlagsForNode(node: CommandNode | null): string[] {
  if (!node) return ['help'];

  const contextDef = node.config.context;
  if (!contextDef) return ['help'];

  const flags = new Set<string>();
  for (const [name, def] of Object.entries(contextDef)) {
    if (!isContextFieldDef(def)) continue;
    flags.add(camelToKebab(name));
    for (const alias of def.aliases ?? []) {
      const normalized = normalizeFlagName(alias);
      if (normalized) {
        flags.add(camelToKebab(normalized));
      }
    }
  }

  const completions = [...flags, 'help'];

  return completions;
}

function getFieldDefForFlag(flagName: string, node: CommandNode | null) {
  if (!node) return null;
  const contextDef = node.config.context;
  if (!contextDef) return null;

  const normalized = normalizeFlagName(flagName);
  for (const [name, def] of Object.entries(contextDef)) {
    if (!isContextFieldDef(def)) continue;

    if (normalizeFlagName(name) === normalized || camelToKebab(name) === camelToKebab(normalized)) {
      return def;
    }

    for (const alias of def.aliases ?? []) {
      if (normalizeFlagName(alias) === normalized) {
        return def;
      }
    }
  }

  return null;
}

/**
 * Get choices for a specific flag
 */
function getChoicesForFlag(flagName: string, node: CommandNode | null): string[] | undefined {
  const fieldDef = getFieldDefForFlag(flagName, node);
  if (!fieldDef || !isContextFieldDef(fieldDef)) return undefined;

  // Check for explicit choices first
  if (fieldDef.choices && fieldDef.choices.length > 0) {
    return fieldDef.choices;
  }

  // Try to extract from schema
  const choices = extractEnumChoices(fieldDef.schema);
  if (choices && choices.length > 0) {
    return choices;
  }

  const info = getSchemaInfo(fieldDef.schema);
  // For boolean, suggest true/false
  if (info.type === 'boolean') {
    return ['true', 'false'];
  }

  return undefined;
}

function normalizeFlagName(str: string): string {
  return kebabToCamel(str.replace(/^--/, ''));
}

// =============================================================================
// Shell Detection
// =============================================================================

/**
 * Detect the current shell from environment
 */
export function detectShell(): Shell {
  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  // Default to bash
  return 'bash';
}

/**
 * Get installation instructions for a shell
 */
export function getInstallInstructions(appName: string, shell: Shell): string {
  switch (shell) {
    case 'bash':
      return `# Add to ~/.bashrc or ~/.bash_profile:
source <(${appName} completion bash)`;
    case 'zsh':
      return `# Add to ~/.zshrc:
source <(${appName} completion zsh)`;
    case 'fish':
      return `# Run once to install:
${appName} completion fish > ~/.config/fish/completions/${appName}.fish`;
    case 'powershell':
      return `# Add to your PowerShell profile ($PROFILE):
${appName} completion powershell | Out-String | Invoke-Expression

# Or save to a file and dot-source it:
${appName} completion powershell > ${appName}-completion.ps1
. ./${appName}-completion.ps1`;
  }
}

/**
 * Check if a shell name is valid
 */
export function isValidShell(shell: string): shell is Shell {
  return shell === 'bash' || shell === 'zsh' || shell === 'fish' || shell === 'powershell';
}
