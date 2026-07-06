/**
 * File-based command router
 *
 * Discovers commands from a commands directory,
 * builds a command tree, and handles navigation + execution.
 *
 * Supports two modes:
 * 1. Explicit config: Pass commandsDir and projectRoot
 * 2. Autodiscovery: Finds commands/ sibling directory from calling file
 */
import * as fs from 'fs';
import * as path from 'path';
import picomatch from 'picomatch';

import { getRuntime, detectPackageManagerFromLockfile } from '../runtime';
import { formatTable, formatCsv } from './tabular';
import { markOperational, markPresented } from './errors';
import type {
  CommandConfig,
  ContextDef,
  CommandNode,
  CommandTree,
  HookContext,
  MountContext,
  MountableLike,
} from './command';
import {
  compose,
  fromDirectory,
  fromPackageScripts,
  fromPackageCommands,
  fromStatic,
  noop,
  resolveMountable,
  tagNodes,
} from './plugins';

import type { CheckConfig } from './check';
import {
  parseContext,
  resolveInteractiveContext,
  validateRequiredContext,
  extractChoices,
} from './args';
import { resolveChecks, runPreChecks, runChecksGroup } from './prechecks';
import { CLIError, type ErrorContext } from './cli-error';
import { findClosestMatch } from './string-distance';
import { createRunner, AbortError } from './runner';
import { CancelError, CANCEL_EXIT_CODE } from './cancel';
import { appendHistory } from './history';
import { generateHelp, generateRootHelp, generateRecursiveHelp, hasHelpFlag, hasVersionFlag } from './help';
import {
  generateCompletionScript,
  generateCompletions,
  detectShell,
  getInstallInstructions,
  isValidShell,
  type Shell,
} from './completion';
import type { Prompter, Navigator, NavOption } from '../prompter';
import { createMenuNavigator } from '../prompter';
import type { ReporterAdapter, ReporterAdapterController, Reporter, EventBus } from '../events';
import { createEventBus, createRootReporter, emitRootEnd } from '../events';

/**
 * Error class for router-level failures.
 * These errors indicate the command cannot proceed and the CLI should exit.
 */
export class RouterError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'RouterError';
    markOperational(this);
    // RouterError is an exit-code carrier: it is thrown only after its message
    // has already been surfaced (via reporter.error / CLIError.format), so the
    // top-level handler should stay silent and just honour the exit code.
    markPresented(this);
  }
}

/**
 * Router configuration
 */
export type RouterConfig = {
  /** Directory containing command files (*.ts) */
  commandsDir: string;
  /** Project root for running shell commands */
  projectRoot: string;
  /** App name for intro message (defaults to directory name) */
  appName?: string;
  /** Reporter adapter for output rendering */
  reporterAdapter: ReporterAdapter;
  /** Prompter for interactive input */
  prompter: Prompter;
  /**
   * Navigator for interactive menu presentation policy.
   * Defaults to the built-in menu navigator (createMenuNavigator) when omitted.
   */
  navigator?: Navigator;
  /** Optional version string (auto-discovered from package.json if not provided) */
  version?: string;
  /** Disable interactive prompts and menus */
  noTty?: boolean;
  /**
   * Package manager scripts to include as commands.
   * - true: Include all scripts from root package.json
   * - string[]: List of script names, glob patterns (e.g. 'test:*'),
   *   or package discovery paths (e.g. 'packages/*')
   */
  pmScripts?: boolean | string[];

  /**
   * Native package manager commands to include (e.g. 'install', 'add', 'run').
   * - true: Include standard lifecycle commands
   * - string[]: List of specific commands to include
   */
  pmCommands?: boolean | string[];

  /**
   * Extra commands to inject into the tree manually.
   * Useful for dynamically generated commands or internal tooling.
   */
  extraCommands?: Record<string, import('./command').CommandConfig>;

  /**
   * Plugins to mount at the root.
   * Allows injecting dynamic command sources (e.g. from other packages).
   */
  plugins?: MountableLike[];
  /**
   * App-level/global flags accepted regardless of command position.
   */
  globalContext?: ContextDef;
  /**
   * Callback invoked after global context is parsed and validated.
   */
  onGlobalContext?: (context: Record<string, unknown>) => void | Promise<void>;
  /**
   * Output format override from --format flag.
   * When set, commands with output schemas serialize their return value
   * in the specified format to stdout.
   */
  outputFormat?: 'json' | 'table' | 'csv';
};

/**


 * Runtime context containing all state needed during router execution.
 * This replaces the previous module-level global state.
 */
export type RouterContext = {
  /** The router configuration */
  config: RouterConfig;
  /** Event bus for emitting and subscribing to events */
  eventBus: EventBus;
  /** Reporter for emitting events */
  reporter: Reporter;
  /** Controller for the reporter adapter */
  adapterController: ReporterAdapterController;
  /** Resolved app name */
  appName: string;
  /** Project root directory */
  projectRoot: string;
  /** Prompter for interactive input */
  prompter: Prompter;
  /** Navigator for interactive menu presentation policy */
  navigator: Navigator;
  /** Resolved app-level/global context values */
  globalContext: Record<string, unknown>;
};

/**
 * Validate that there are no alias conflicts within a command tree level.
 *
 * Rules:
 * 1. Command names must be unique
 * 2. Aliases must not conflict with any command name
 * 3. Aliases must not conflict with other aliases
 *
 * @throws Error if any conflict is detected
 */
function validateAliases(tree: CommandTree, pathPrefix: string = ''): void {
  // Map of name/alias -> command that owns it
  const seen = new Map<string, string>();

  for (const [segment, node] of tree) {
    const fullPath = pathPrefix ? `${pathPrefix}.${segment}` : segment;

    // Check command name
    if (seen.has(segment)) {
      throw new Error(
        `Command name "${segment}" at "${fullPath}" conflicts with "${seen.get(segment)}"`
      );
    }
    seen.set(segment, fullPath);

    // Check aliases
    const aliases = node.config.aliases || [];
    for (const alias of aliases) {
      if (seen.has(alias)) {
        throw new Error(
          `Alias "${alias}" of command "${fullPath}" conflicts with "${seen.get(alias)}"`
        );
      }
      seen.set(alias, fullPath);
    }

    // Recursively validate children
    if (node.children.size > 0) {
      validateAliases(node.children, fullPath);
    }
  }
}

function getNodeProjectRoot(node: CommandNode, ctx: RouterContext): string {
  return node.projectRoot ?? ctx.projectRoot;
}

/**
 * Load all command files and build a command tree
 */
export async function buildCommandTree(
  commandsDir: string,
  ctx: RouterContext
): Promise<CommandTree> {
  const { config, projectRoot, reporter, prompter } = ctx;

  // Build the root composition
  const rootMountable = compose(
    // 1. Package Manager Scripts
    config.pmScripts ? fromPackageScripts(config.pmScripts, projectRoot) : noop(),

    // 2. Package Manager Commands
    config.pmCommands ? fromPackageCommands(config.pmCommands, projectRoot) : noop(),

    // 3. Extra Commands
    config.extraCommands ? fromStatic(config.extraCommands) : noop(),

    // 4. Plugins (Root Mountables)
    ...(config.plugins || []),

    // 5. File-based commands (legacy/standard way)
    fromDirectory(commandsDir)
  );

  const mountCtx: MountContext = {
    path: [],
    ...ctx,
  };

  try {
    // 1. Resolve root
    const rootResult = await resolveMountable(rootMountable, mountCtx);
    const tree = rootResult.tree;

    // 2. Recursively expand
    await expandTree(tree, mountCtx, new Set([rootResult.mountSourceId]));

    // 3. Validate aliases
    validateAliases(tree);

    return tree;
  } catch (error) {
    reporter.error(`Failed to build command tree: ${error}`);
    throw error;
  }
}

function rebasePaths(node: CommandNode, parentPath: string[]): void {
  node.path = [...parentPath, ...node.path];
  for (const child of node.children.values()) {
    rebasePaths(child, parentPath);
  }
}

async function expandTree(
  tree: CommandTree,
  ctx: MountContext,
  visited: Set<string>
): Promise<void> {
  for (const node of tree.values()) {
    let branchVisited = visited;

    if (node.config.mount) {
      const effectiveProjectRoot = node.projectRoot ?? ctx.projectRoot;
      const childContext: MountContext = {
        ...ctx,
        projectRoot: effectiveProjectRoot,
        path: [...ctx.path, node.segment],
      };

      const result = await resolveMountable(node.config.mount, childContext);

      if (!result.mountSourceId) {
        throw new Error(`Mount result missing mountSourceId at path "${node.path.join('.')}"`);
      }

      // Cycle detection: a mount source reappearing on the same branch means a
      // mount is (directly or transitively) mounting itself. Fail fast.
      if (visited.has(result.mountSourceId)) {
        throw new Error(
          `Cycle detected while mounting at "${node.path.join('.')}": mount source "${result.mountSourceId}" is already on this branch`
        );
      }

      branchVisited = new Set(visited);
      branchVisited.add(result.mountSourceId);

      // Merge children
      for (const [childKey, childNode] of result.tree) {
        if (node.children.has(childKey)) {
          // Collision policy: fail fast
          throw new Error(
            `Command collision: "${childKey}" already exists in "${node.path.join('.')}"`
          );
        }

        // Tag with provenance
        tagNodes(childNode, result.mountSourceId);

        // Fix paths: mounted children have paths relative to the sub-tree,
        // but need to include the parent's path prefix for correct history replay
        rebasePaths(childNode, node.path);

        node.children.set(childKey, childNode);
      }
    }

    if (node.children.size > 0) {
      await expandTree(node.children, { ...ctx, path: [...ctx.path, node.segment] }, branchVisited);
    }
  }
}

/**
 * Find a node in a tree level by name or alias.
 *
 * Exact name matches take precedence over alias matches. This enables
 * commands to define shorthand aliases without conflicting with other
 * command names.
 *
 * @internal
 * @param level - The current level of the command tree to search
 * @param name - The command name or alias to find
 * @returns The matched node, or undefined if not found
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
 * Find a node in the tree by path segments.
 *
 * Traverses the command tree following the provided segments until either
 * all segments are consumed or no matching child is found. Supports both
 * exact command names and aliases, with exact names taking precedence.
 *
 * @internal
 * @param tree - The root command tree to search
 * @param segments - The path segments to follow (e.g., ['generate', 'types'])
 * @returns The deepest matched node and any remaining unmatched segments, or null if no match
 *
 * @example
 * // Given tree with 'generate' -> 'types' -> 'cloudflare'
 * findNode(tree, ['generate', 'types', '--verbose'])
 * // Returns { node: typesNode, remainingArgs: ['--verbose'] }
 */
function findNode(
  tree: CommandTree,
  segments: string[]
): { node: CommandNode; remainingArgs: string[] } | null {
  if (segments.length === 0) return null;

  let currentLevel = tree;
  let lastMatchedNode: CommandNode | null = null;
  let matchedCount = 0;

  for (const segment of segments) {
    const node = findNodeByNameOrAlias(currentLevel, segment);
    if (!node) break;

    lastMatchedNode = node;
    matchedCount++;
    currentLevel = node.children;
  }

  if (!lastMatchedNode) return null;

  return {
    node: lastMatchedNode,
    remainingArgs: segments.slice(matchedCount),
  };
}

/**
 * Get all leaf nodes (commands with run functions) under a node
 */
function getLeafNodes(node: CommandNode): CommandNode[] {
  const leaves: CommandNode[] = [];

  const traverse = (n: CommandNode) => {
    if (n.config.run) {
      leaves.push(n);
    }
    const children = Array.from(n.children.values()).sort((a, b) =>
      a.segment.localeCompare(b.segment)
    );
    for (const child of children) {
      traverse(child);
    }
  };

  traverse(node);
  return leaves;
}

/**
 * Resolve checks from a command's pre configuration
 */
// (pre-check helpers moved to ./prechecks so router and SDK runtime match)

/**
 * Execute a command node.
 *
 * Handles both leaf commands (with a `run` function) and parent nodes (without).
 * For leaf commands, delegates to `executeLeaf` which handles context resolution,
 * pre-checks, and actual execution. For parent nodes, displays an interactive
 * submenu of available children.
 *
 * @internal
 * @param node - The command node to execute
 * @param tree - Full command tree (for navigation context)
 * @param args - Command line arguments (flags and remaining positional args)
 * @param ctx - Router context containing reporter, prompter, and configuration
 * @param fromMenu - Whether invoked from the interactive menu (affects prompting behavior)
 * @param menuOpen - Whether the menu intro box is still open (needs closing after context)
 */
async function executeNode(
  node: CommandNode,
  tree: CommandTree,
  args: string[],
  ctx: RouterContext,
  fromMenu: boolean = false,
  menuOpen: boolean = false,
  signal?: AbortSignal
): Promise<void> {
  const { config } = node;
  const { reporter } = ctx;

  // If node has a run function, execute it
  if (config.run) {
    await executeLeaf(node, args, ctx, { fromMenu, menuOpen, signal });
    return;
  }

  // Parent node - show submenu of children
  const children = Array.from(node.children.values());

  if (children.length === 0) {
    throw new RouterError(`Command "${node.path.join('.')}" has no implementation or children`);
  }

  if (ctx.config.noTty) {
    const helpText = generateHelp({
      commandPath: node.path,
      command: config,
      children,
      appName: ctx.appName,
    });
    console.log(helpText);
    return;
  }

  // If not already in a menu group, wrap in one
  if (!menuOpen) {
    await reporter.group(config.label, { layout: 'sequence' }, async () => {
      await showParentSubmenu(node, tree, args, ctx, true, signal);
    });
    return;
  }

  // Already in a group - show submenu directly
  await showParentSubmenu(node, tree, args, ctx, menuOpen, signal);
}

/**
 * Build the list of menu options for a node's children, optionally including
 * the synthetic "all" option when the node supports running all children.
 */
function buildMenuOptions(
  enableRunAllChildren: CommandConfig['enableRunAllChildren'],
  children: CommandNode[]
): NavOption[] {
  const options: NavOption[] = [];

  if (enableRunAllChildren) {
    options.push({ value: '__all__', label: 'all - Run all commands' });
  }

  for (const child of [...children].sort((a, b) => a.segment.localeCompare(b.segment))) {
    const description = child.config.description || child.config.label;
    options.push({
      value: child.segment,
      label: `${child.segment} - ${description}`,
    });
  }

  return options;
}

/**
 * Show submenu for a parent node and handle selection
 */
async function showParentSubmenu(
  node: CommandNode,
  tree: CommandTree,
  args: string[],
  ctx: RouterContext,
  menuOpen: boolean,
  signal?: AbortSignal
): Promise<void> {
  const { config } = node;
  const { reporter, navigator } = ctx;
  const children = Array.from(node.children.values());

  // Build menu options
  const options = buildMenuOptions(config.enableRunAllChildren, children);

  const choice = await navigator.choose({
    appName: ctx.appName,
    path: node.path,
    message: `Select ${node.segment}:`,
    options,
    reporter,
  });

  // Cancellation at this direct-submenu level aborts (there is no parent menu
  // to return to in this execution path).
  if (choice.type !== 'select') {
    throw new CancelError('Cancelled', CANCEL_EXIT_CODE);
  }
  const selected = choice.value;

  if (selected === '__all__') {
    // Close menu group before running all children
    reporter.success('Selected');
    await executeAllChildren(node, args, ctx, true, false, signal);
    return;
  }

  const selectedChild = node.children.get(String(selected));
  if (!selectedChild) {
    throw new RouterError(`Child command not found: ${String(selected)}`);
  }

  // Recurse into selected child (menu stays open through navigation)
  await executeNode(selectedChild, tree, args, ctx, true, menuOpen, signal);
}

/**
 * Options for executing a leaf command
 */
type ExecuteLeafOptions = {
  /** Whether invoked from the interactive menu */
  fromMenu: boolean;
  /** Whether the menu intro box is still open (needs closing after context) */
  menuOpen?: boolean;
  /** When true, capture stdout/stderr instead of streaming to terminal */
  quiet?: boolean;
  /** AbortSignal for cancelling execution */
  signal?: AbortSignal;
  /** Skip pre-checks (used when checks have been lifted and run earlier) */
  skipPreChecks?: boolean;
};

/**
 * Ensure arguments are provided if the command requests them.
 * Prompts the user if arguments are missing and interaction is allowed.
 */
async function ensureArgs(
  args: string[],
  config: CommandConfig,
  prompter: Prompter,
  allowPrompt: boolean
): Promise<string[]> {
  if (config.requestArgs && args.length === 0 && allowPrompt) {
    const input = await prompter.text({
      message: `Enter arguments for "${config.label}":`,
      placeholder: 'e.g. build --filter...',
    });

    if (typeof input === 'string' && input.trim()) {
      return input.trim().split(/\s+/);
    }
  }
  return args;
}

/**
 * Execute a leaf command (one with a run function)
 *
 * @param node - The command node to execute
 * @param args - Command line arguments (flags and remaining positional args)
 * @param ctx - Router context
 * @param options - Execution options
 */
async function executeLeaf(
  node: CommandNode,
  args: string[],
  ctx: RouterContext,
  options: ExecuteLeafOptions
): Promise<void> {
  const { fromMenu, menuOpen = false, quiet = false, signal, skipPreChecks = false } = options;
  const { config } = node;
  const contextDef = config.context || {};
  const { reporter, prompter, eventBus, appName } = ctx;
  const projectRoot = getNodeProjectRoot(node, ctx);

  // Check if already aborted before starting
  if (signal?.aborted) {
    throw new AbortError();
  }

  // Build error context for rich error messages
  const errorContext: ErrorContext = {
    appName,
    commandPath: node.path,
  };

  // Parse context from args
  const parsed = parseContext(args, contextDef, {
    errorContext,
    ignoreUnknownFlags: config.ignoreUnknownFlags,
  });

  // Extract choices for interactive prompts
  const choices = extractChoices(contextDef);

  const allowPrompt = !ctx.config.noTty;

  // Resolve interactive context (prompts appear inside menu box if menuOpen)
  const resolvedContext = await resolveInteractiveContext(
    parsed.context,
    contextDef,
    choices,
    prompter,
    fromMenu && allowPrompt,
    allowPrompt
  );

  // Validate required context fields
  validateRequiredContext(resolvedContext, contextDef, { errorContext });

  // Close menu box after context resolution (emit group end for menu)
  if (menuOpen) {
    reporter.success('Selected');
  }

  // Build hook context
  const extraArgs = await ensureArgs(parsed.rest, config, prompter, allowPrompt);
  const hookCtx = {
    ...resolvedContext,
    extraArgs,
    cwd: projectRoot,
  };

  // Run pre checks as a group (unless already run by batch executor)
  if (!skipPreChecks) {
    await runPreChecks(config, hookCtx, reporter);
  }

  // Build run context
  const runCtx = {
    context: resolvedContext,
    globalContext: ctx.globalContext,
    extraArgs,
    cwd: projectRoot,
  };

  appendHistory(appName, node.path, args);

  // Run main execution with runner and context
  if (config.run) {
    const runner = createRunner({
      cwd: projectRoot,
      context: resolvedContext,
      extraArgs,
      timeout: config.timeout,
      quiet,
      signal,
      eventBus,
      prompter,
    });
    try {
      const result = await config.run(runner, runCtx);

      // Handle structured output if command defines an output schema
      if (config.output && result !== undefined) {
        handleCommandOutput(result, config, ctx);
      }
    } finally {
      runner.dispose?.();
    }
  }
}

/**
 * Handle structured output from a command with an output schema.
 * Routes to the appropriate formatter based on --format flag.
 */
function handleCommandOutput(
  data: unknown,
  config: CommandConfig,
  ctx: RouterContext
): void {
  const format = ctx.config.outputFormat;

  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else if (format === 'table' || format === 'csv') {
    const rendered =
      format === 'table'
        ? formatTable(data, config.output)
        : formatCsv(data, config.output);
    if (rendered === null) {
      // Data can't be represented as a table/CSV (e.g. a scalar or a nested
      // value). Note the fallback on stderr and emit JSON instead of silently
      // mis-rendering.
      process.stderr.write(
        `Note: output is not tabular; falling back to JSON (--format ${format} ignored).\n`
      );
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(rendered);
    }
  } else if (config.format) {
    // Human-readable format via the command's format function
    const reporter = ctx.reporter as import('../events').CommandReporter;
    config.format(data, reporter);
  } else {
    // No format function, no --format flag: fall back to JSON
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Resolved context for a leaf node
 */
type LeafWithContext = {
  node: CommandNode;
  resolvedContext: any;
  extraArgs: string[];
};

/**
 * Execute all leaf children of a parent node
 *
 * Lifts all pre-checks from leaf commands into a single "Pre-flight Checks"
 * group that runs before any commands execute.
 */
/**
 * Phase 1: Resolve context for each leaf command
 */
async function resolveChildrenContexts(
  leaves: CommandNode[],
  args: string[],
  ctx: RouterContext,
  fromMenu: boolean
): Promise<LeafWithContext[]> {
  const { prompter, appName } = ctx;
  const leavesWithContext: LeafWithContext[] = [];

  for (const leaf of leaves) {
    const contextDef = leaf.config.context || {};
    const errorContext: ErrorContext = {
      appName,
      commandPath: leaf.path,
    };
    const parsed = parseContext(args, contextDef, {
      errorContext,
      ignoreUnknownFlags: leaf.config.ignoreUnknownFlags,
    });
    const choices = extractChoices(contextDef);
    const allowPrompt = !ctx.config.noTty;
    const resolvedContext = await resolveInteractiveContext(
      parsed.context,
      contextDef,
      choices,
      prompter,
      fromMenu && allowPrompt,
      allowPrompt
    );
    validateRequiredContext(resolvedContext, contextDef, { errorContext });

    leavesWithContext.push({
      node: leaf,
      resolvedContext,
      extraArgs: parsed.rest,
    });
  }

  return leavesWithContext;
}

/**
 * Phase 2: Collect and deduplicate pre-checks
 */
async function collectPreChecks(
  leavesWithContext: LeafWithContext[],
  ctx: RouterContext
): Promise<CheckConfig[]> {
  const seen = new Set<CheckConfig>();
  const allChecks: CheckConfig[] = [];

  for (const { node: leaf, resolvedContext, extraArgs } of leavesWithContext) {
    const projectRoot = getNodeProjectRoot(leaf, ctx);
    const hookCtx: HookContext = {
      ...resolvedContext,
      extraArgs,
      cwd: projectRoot,
    };
    const checks = await resolveChecks(leaf.config.pre, hookCtx);
    for (const check of checks) {
      if (!seen.has(check)) {
        seen.add(check);
        allChecks.push(check);
      }
    }
  }

  return allChecks;
}

/**
 * Phase 4: Execute children execution group (sequential or parallel)
 */
async function executeChildrenGroup(
  node: CommandNode,
  leavesWithContext: LeafWithContext[],
  ctx: RouterContext,
  quiet: boolean,
  signal?: AbortSignal
): Promise<void> {
  const mode = node.config.enableRunAllChildren;
  const groupLabel = node.config.label;
  const { reporter } = ctx;

  if (mode === 'sequential') {
    await reporter.group(groupLabel, { layout: 'sequence' }, async (grp) => {
      for (const { node: leaf, resolvedContext, extraArgs } of leavesWithContext) {
        await grp.activity(leaf.config.label, async () => {
          await executeLeafWithContext(leaf, resolvedContext, extraArgs, ctx, {
            quiet,
            skipPreChecks: true,
            signal,
          });
        });
      }
    });
  }

  if (mode === 'parallel') {
    await reporter.group(groupLabel, { layout: 'parallel' }, async (grp) => {
      const controller = new AbortController();
      const groupSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;
      let firstError: unknown = null;

      await Promise.allSettled(
        leavesWithContext.map(async ({ node: leaf, resolvedContext, extraArgs }) => {
          if (controller.signal.aborted) return;

          try {
            await grp.activity(leaf.config.label, async () => {
              await executeLeafWithContext(leaf, resolvedContext, extraArgs, ctx, {
                quiet,
                skipPreChecks: true,
                signal: groupSignal,
              });
            });
          } catch (error) {
            if (error instanceof AbortError || controller.signal.aborted) return;
            if (!firstError) {
              firstError = error;
              controller.abort();
            }
          }
        })
      );

      if (firstError) {
        throw firstError;
      }
    });
  }
}

/**
 * Execute all leaf children of a parent node
 *
 * Lifts all pre-checks from leaf commands into a single "Pre-flight Checks"
 * group that runs before any commands execute.
 */
async function executeAllChildren(
  node: CommandNode,
  args: string[],
  ctx: RouterContext,
  fromMenu: boolean,
  menuOpen: boolean = false,
  signal?: AbortSignal
): Promise<void> {
  const mode = node.config.enableRunAllChildren;
  const { reporter } = ctx;

  if (!mode) {
    throw new RouterError('enableRunAllChildren not configured');
  }

  const leaves = getLeafNodes(node);

  if (leaves.length === 0) {
    throw new RouterError(`No executable children found under "${node.path.join('.')}"`);
  }

  // Close menu if open before running multiple commands
  if (menuOpen) {
    reporter.success('Selected');
  }

  const quiet = node.config.quietRunAll !== false;

  // Phase 1: Resolve context for each leaf
  const leavesWithContext = await resolveChildrenContexts(leaves, args, ctx, fromMenu);

  // Phase 2: Collect all pre-checks
  const allChecks = await collectPreChecks(leavesWithContext, ctx);

  // Phase 3: Run all pre-checks in one group
  await runChecksGroup(allChecks, reporter);

  // Phase 4: Run all leaves as activities within a single group
  await executeChildrenGroup(node, leavesWithContext, ctx, quiet, signal);
}

/**
 * Execute a leaf command with pre-resolved context.
 * Used when context has already been resolved (e.g., from menu selection).
 */
async function executeLeafWithContext(
  node: CommandNode,
  resolvedContext: any,
  extraArgs: string[],
  ctx: RouterContext,
  options: {
    quiet?: boolean;
    signal?: AbortSignal;
    skipPreChecks?: boolean;
  } = {}
): Promise<void> {
  const { quiet = false, signal, skipPreChecks = false } = options;
  const { config } = node;
  const { reporter, prompter, eventBus } = ctx;
  const projectRoot = getNodeProjectRoot(node, ctx);

  // Check if already aborted before starting
  if (signal?.aborted) {
    throw new AbortError();
  }

  // Ensure arguments are provided if requested
  const allowPrompt = !ctx.config.noTty;
  const finalArgs = await ensureArgs(extraArgs, config, prompter, allowPrompt);

  // Build hook context
  const hookCtx = {
    ...resolvedContext,
    extraArgs: finalArgs,
    cwd: projectRoot,
  };

  // Run pre checks as a group (unless already run by batch executor)
  if (!skipPreChecks) {
    await runPreChecks(config, hookCtx, reporter);
  }

  // Build run context
  const runCtx = {
    context: resolvedContext,
    globalContext: ctx.globalContext,
    extraArgs: finalArgs,
    cwd: projectRoot,
  };

  appendHistory(ctx.appName, node.path, finalArgs);

  // Run main execution with runner and context
  if (config.run) {
    const runner = createRunner({
      cwd: projectRoot,
      context: resolvedContext,
      extraArgs: finalArgs,
      timeout: config.timeout,
      quiet,
      signal,
      eventBus,
      prompter,
    });
    try {
      await config.run(runner, runCtx);
    } finally {
      runner.dispose?.();
    }
  }
}

/**
 * Execute all leaf children with pre-resolved context.
 * Used when context has already been resolved (e.g., from menu selection).
 *
 * Lifts all pre-checks from leaf commands into a single "Pre-flight Checks"
 * group that runs before any commands execute.
 */
async function executeAllChildrenWithContext(
  node: CommandNode,
  resolvedContext: any,
  extraArgs: string[],
  ctx: RouterContext
): Promise<void> {
  const mode = node.config.enableRunAllChildren;
  const { reporter } = ctx;

  if (!mode) {
    throw new RouterError('enableRunAllChildren not configured');
  }

  const leaves = getLeafNodes(node);

  if (leaves.length === 0) {
    throw new RouterError(`No executable children found under "${node.path.join('.')}"`);
  }

  const quiet = node.config.quietRunAll !== false;

  // Phase 1: Collect all pre-checks (deduplicated by reference, preserving order)
  // All leaves share the same resolvedContext in this path
  const seen = new Set<CheckConfig>();
  const allChecks: CheckConfig[] = [];

  for (const leaf of leaves) {
    const projectRoot = getNodeProjectRoot(leaf, ctx);
    const hookCtx: HookContext = {
      ...resolvedContext,
      extraArgs,
      cwd: projectRoot,
    };
    const checks = await resolveChecks(leaf.config.pre, hookCtx);
    for (const check of checks) {
      if (!seen.has(check)) {
        seen.add(check);
        allChecks.push(check);
      }
    }
  }

  // Phase 2: Run all pre-checks in one group
  await runChecksGroup(allChecks, reporter);

  // Phase 3: Run all leaves as activities within a single group
  const groupLabel = node.config.label;

  if (mode === 'sequential') {
    await reporter.group(groupLabel, { layout: 'sequence' }, async (grp) => {
      for (const leaf of leaves) {
        await grp.activity(leaf.config.label, async () => {
          await executeLeafWithContext(leaf, resolvedContext, extraArgs, ctx, {
            quiet,
            skipPreChecks: true,
          });
        });
      }
    });
  }

  if (mode === 'parallel') {
    await reporter.group(groupLabel, { layout: 'parallel' }, async (grp) => {
      const controller = new AbortController();
      let firstError: unknown = null;

      await Promise.allSettled(
        leaves.map(async (leaf) => {
          if (controller.signal.aborted) return;

          try {
            await grp.activity(leaf.config.label, async () => {
              await executeLeafWithContext(leaf, resolvedContext, extraArgs, ctx, {
                quiet,
                skipPreChecks: true,
                signal: controller.signal,
              });
            });
          } catch (error) {
            if (error instanceof AbortError || controller.signal.aborted) return;
            if (!firstError) {
              firstError = error;
              controller.abort();
            }
          }
        })
      );

      if (firstError) {
        throw firstError;
      }
    });
  }
}

/**
 * Result of menu selection - contains the selected node and resolved context
 */
type MenuSelectionResult =
  | {
      node: CommandNode;
      extraArgs: string[];
      runAll: true;
    }
  | {
      node: CommandNode;
      context: any;
      extraArgs: string[];
      runAll: false;
    };

/**
 * Handle interactive menu selection, including any context prompts.
 * Returns the selected node and resolved context, or null if selection fails.
 * This function handles ONLY the selection phase - execution happens afterward.
 *
 * Navigation is stack-based: choosing a parent descends a level, and the
 * Navigator returning 'back' pops back up. Cancelling at the top level unwinds
 * the whole menu (Ctrl-C at the root exits the CLI).
 */
async function selectFromMenu(
  tree: CommandTree,
  ctx: RouterContext
): Promise<MenuSelectionResult | null> {
  const { reporter, prompter, navigator, appName } = ctx;
  const topLevel = Array.from(tree.values()).sort((a, b) => a.segment.localeCompare(b.segment));

  if (topLevel.length === 0) {
    reporter.error('No commands available');
    return null;
  }

  // Menu selection wrapped in a group - this closes BEFORE execution
  return reporter.group(appName, { layout: 'sequence' }, async () => {
    // Stack of chosen parent nodes describing the descent from the root.
    const stack: CommandNode[] = [];

    while (true) {
      const currentNode = stack.length > 0 ? stack[stack.length - 1]! : null;
      const levelNodes = currentNode
        ? Array.from(currentNode.children.values())
        : topLevel;

      if (currentNode && levelNodes.length === 0) {
        reporter.error(
          `Command "${currentNode.path.join('.')}" has no implementation or children`
        );
        return null;
      }

      const options = buildMenuOptions(currentNode?.config.enableRunAllChildren, levelNodes);
      const message = currentNode ? `Select ${currentNode.segment}:` : 'What would you like to do?';

      const choice = await navigator.choose({
        appName,
        path: stack.map((n) => n.segment),
        message,
        options,
        reporter,
      });

      // Up-navigation: pop a level, or unwind entirely at the root.
      if (choice.type === 'back' || choice.type === 'exit') {
        if (choice.type === 'exit' || stack.length === 0) {
          throw new CancelError('Cancelled', CANCEL_EXIT_CODE);
        }
        stack.pop();
        continue;
      }

      const selected = choice.value;

      // "Run all children" selection
      if (selected === '__all__' && currentNode) {
        reporter.success('Selected');
        return {
          node: currentNode,
          extraArgs: [],
          runAll: true,
        };
      }

      const nextNode = currentNode
        ? currentNode.children.get(selected)
        : tree.get(selected);

      if (!nextNode) {
        reporter.error(`Command not found: ${selected}`);
        return null;
      }

      // Parent node - descend a level and keep navigating.
      if (!nextNode.config.run) {
        stack.push(nextNode);
        continue;
      }

      // Leaf command - resolve its context and return.
      const config = nextNode.config;
      const contextDef = config.context || {};
      const errorContext: ErrorContext = {
        appName,
        commandPath: nextNode.path,
      };

      // Parse context from args (empty since we're in menu mode)
      const parsed = parseContext([], contextDef, {
        errorContext,
        ignoreUnknownFlags: config.ignoreUnknownFlags,
      });

      // Extract choices for interactive prompts
      const choices = extractChoices(contextDef);

      const allowPrompt = !ctx.config.noTty;

      // Resolve interactive context (prompts appear inside menu box)
      const resolvedContext = await resolveInteractiveContext(
        parsed.context,
        contextDef,
        choices,
        prompter,
        allowPrompt,
        allowPrompt
      );

      // Validate required context fields
      validateRequiredContext(resolvedContext, contextDef, { errorContext });

      // Mark selection as complete
      reporter.success('Selected');

      return {
        node: nextNode,
        context: resolvedContext,
        extraArgs: parsed.rest,
        runAll: false,
      };
    }
  });
}

/**
 * Show interactive menu and run selected command
 */
async function runMenu(tree: CommandTree, ctx: RouterContext, signal?: AbortSignal): Promise<void> {
  // Phase 1: Selection (wrapped in group, closes after selection)
  const selection = await selectFromMenu(tree, ctx);

  if (!selection) {
    throw new RouterError('No command selected');
  }

  const { node, extraArgs, runAll } = selection;

  // Phase 2: Execution (happens OUTSIDE the menu group)
  // Check if this is a "run all children" scenario
  if (runAll) {
    if (!node.config.run && node.config.enableRunAllChildren) {
      await executeAllChildren(node, extraArgs, ctx, true, false, signal);
    }
    return;
  }

  // Execute the leaf command with pre-resolved context
  await executeLeafWithContext(node, selection.context, extraArgs, ctx, { signal });
}

/**
 * Auto-discover version from package.json if not provided
 */
async function discoverVersion(projectRoot: string): Promise<string | undefined> {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  try {
    const runtime = await getRuntime();
    const content = await runtime.readFile(packageJsonPath);
    const pkg = JSON.parse(content);
    return pkg.version;
  } catch {
    return undefined;
  }
}

async function maybeHandleVersionFlag(
  args: string[],
  config: RouterConfig,
  resolvedAppName: string
): Promise<boolean> {
  if (!hasVersionFlag(args)) return false;

  const version = config.version ?? (await discoverVersion(config.projectRoot));
  if (version) {
    console.log(`${resolvedAppName} ${version}`);
  } else {
    console.log(resolvedAppName);
  }
  return true;
}

function maybeHandleHelpCommand(
  args: string[],
  tree: CommandTree,
  resolvedAppName: string,
  globalContext?: ContextDef
): boolean {
  if (args[0] !== 'help') return false;

  const subArgs = args.slice(1);

  // `help <command>` — show recursive help for a specific subtree
  if (subArgs.length > 0) {
    const match = findNode(tree, subArgs);
    if (match) {
      const helpText = generateRecursiveHelp({
        appName: resolvedAppName,
        tree,
        subtree: match.node,
        globalContext,
      });
      console.log(helpText);
      return true;
    }
  }

  // `help` with no args — show full CLI reference
  const helpText = generateRecursiveHelp({
    appName: resolvedAppName,
    tree,
    globalContext,
  });
  console.log(helpText);
  return true;
}

function maybeHandleCompletionCommand(
  args: string[],
  tree: CommandTree,
  resolvedAppName: string
): boolean {
  // Handle hidden __complete command for dynamic shell completions
  if (args[0] === '__complete') {
    const completionArgs = args.slice(1);
    const completions = generateCompletions(completionArgs, tree);
    console.log(completions.join('\n'));
    return true;
  }

  // Handle completion script generation command
  if (args[0] === 'completion') {
    const shellArg = args[1];
    const shell: Shell = shellArg && isValidShell(shellArg) ? shellArg : detectShell();

    const script = generateCompletionScript(resolvedAppName, shell);
    console.log(script);
    console.error('');
    console.error(getInstallInstructions(resolvedAppName, shell));
    return true;
  }

  return false;
}

function renderRootHelp(
  tree: CommandTree,
  appName: string,
  globalContext?: ContextDef
): void {
  const topLevelCommands = Array.from(tree.values());
  const helpText = generateRootHelp({
    appName,
    commands: topLevelCommands,
    globalContext,
  });
  console.log(helpText);
}

async function resolveGlobalContextArgs(
  args: string[],
  config: RouterConfig,
  resolvedAppName: string
): Promise<{ args: string[]; context: Record<string, unknown> }> {
  const globalContextDef = config.globalContext;
  if (!globalContextDef || Object.keys(globalContextDef).length === 0) {
    return { args, context: {} };
  }

  const errorContext: ErrorContext = {
    appName: resolvedAppName,
    commandPath: [],
  };
  const parsed = parseContext(args, globalContextDef, {
    errorContext,
    ignoreUnknownFlags: true,
  });
  const choices = extractChoices(globalContextDef);
  const allowPrompt = !config.noTty;
  const resolvedContext = await resolveInteractiveContext(
    parsed.context,
    globalContextDef,
    choices,
    config.prompter,
    false,
    allowPrompt
  );
  validateRequiredContext(resolvedContext, globalContextDef, { errorContext });
  if (config.onGlobalContext) {
    await config.onGlobalContext(resolvedContext as Record<string, unknown>);
  }

  return {
    args: parsed.rest,
    context: resolvedContext as Record<string, unknown>,
  };
}

/**
 * Main router entry point
 *
 * @param args - Command line arguments (without 'node' and script name)
 * @param config - Router configuration
 */
export async function run(args: string[], config: RouterConfig): Promise<void> {
  const { commandsDir, projectRoot, appName, reporterAdapter } = config;
  const resolvedAppName = appName ?? path.basename(projectRoot);

  // Version check first - before any reporter setup or command tree building
  if (await maybeHandleVersionFlag(args, config, resolvedAppName)) {
    return;
  }

  // Create event bus and start reporter adapter
  const eventBus = createEventBus();
  const adapterController = reporterAdapter.start(eventBus);
  const reporter = createRootReporter(eventBus, resolvedAppName, config.version);

  let exitCode = 0;

  // Root-level cancellation signal (SIGINT/SIGTERM)
  // This allows cancellation to propagate through the normal router flow so
  // root:end still emits and callers can catch a CancelError.
  const rootController = new AbortController();
  let cancelledBySignal = false;
  const handleSignal = () => {
    cancelledBySignal = true;
    rootController.abort();
  };
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  // Build the router context with all runtime state
  const ctx: RouterContext = {
    config,
    eventBus,
    reporter,
    adapterController,
    appName: resolvedAppName,
    projectRoot,
    prompter: config.prompter,
    navigator: config.navigator ?? createMenuNavigator(config.prompter),
    globalContext: {},
  };

  try {
    const { args: argsWithoutGlobalContext, context: globalContext } = await resolveGlobalContextArgs(
      args,
      config,
      resolvedAppName
    );
    ctx.globalContext = globalContext;

    // Build command tree
    const tree = await buildCommandTree(commandsDir, ctx);

    if (maybeHandleCompletionCommand(argsWithoutGlobalContext, tree, resolvedAppName)) {
      return;
    }

    if (maybeHandleHelpCommand(argsWithoutGlobalContext, tree, resolvedAppName, config.globalContext)) {
      return;
    }

    // Check for --help or -h flag at root level (before any command)
    if (
      argsWithoutGlobalContext.length === 0 ||
      (argsWithoutGlobalContext.length > 0 &&
        hasHelpFlag(argsWithoutGlobalContext) &&
        !findNode(tree, argsWithoutGlobalContext))
    ) {
      // No command specified, just --help - show root help
      if (hasHelpFlag(argsWithoutGlobalContext)) {
        renderRootHelp(tree, resolvedAppName, config.globalContext);
        return;
      }
      if (argsWithoutGlobalContext.length === 0 && config.noTty) {
        renderRootHelp(tree, resolvedAppName, config.globalContext);
        return;
      }
      // No arguments - show interactive menu
      await runMenu(tree, ctx, rootController.signal);
      return;
    }

    // Find command by path (filtering out help flags for matching)
    const argsWithoutHelp = argsWithoutGlobalContext.filter((a) => a !== '--help' && a !== '-h');
    const match = findNode(tree, argsWithoutHelp);

    // Check for help flag - intercept before normal execution
    if (hasHelpFlag(argsWithoutGlobalContext)) {
      if (!match) {
        // Unknown command with --help - show root help
        renderRootHelp(tree, resolvedAppName, config.globalContext);
        return;
      }

      // Show help for the matched command
      const children = Array.from(match.node.children.values());
      const commandPath = match.node.path;
      const helpText = generateHelp({
        commandPath,
        command: match.node.config,
        children: children.length > 0 ? children : undefined,
        appName: resolvedAppName,
      });
      console.log(helpText);
      return;
    }

    if (!match) {
      const unknownCommand = argsWithoutGlobalContext[0];
      const availableCommands = Array.from(tree.keys());
      const suggestion = findClosestMatch(unknownCommand ?? '', availableCommands);

      let errorMessage = `Unknown command: ${unknownCommand}`;
      if (suggestion) {
        errorMessage += `

Did you mean '${suggestion}'?`;
      }
      errorMessage += `

Available commands: ${availableCommands.join(', ')}`;
      errorMessage += `

Run '${resolvedAppName} --help' for usage.`;

      reporter.error(errorMessage);
      throw new RouterError(errorMessage);
    }

    // Check if the next segment is "all" - run all children
    const remainingArgs = match.remainingArgs;
    if (
      remainingArgs.length > 0 &&
      remainingArgs[0] === 'all' &&
      match.node.config.enableRunAllChildren
    ) {
      await executeAllChildren(match.node, remainingArgs.slice(1), ctx, false, false, rootController.signal);
      return;
    }

    // Execute the command with remaining args
    await executeNode(match.node, tree, match.remainingArgs, ctx, false, false, rootController.signal);
  } catch (error) {
    // Format CLIError with usage hints
    if (error instanceof CLIError) {
      console.error(error.format());
      const routerError = new RouterError(error.message);
      exitCode = routerError.exitCode;
      throw routerError;
    }

    if (error instanceof CancelError) {
      exitCode = error.exitCode;
      throw error;
    }

    if (cancelledBySignal && error instanceof AbortError) {
      const cancel = new CancelError('Cancelled', CANCEL_EXIT_CODE);
      exitCode = cancel.exitCode;
      throw cancel;
    }

    exitCode = error instanceof RouterError ? error.exitCode : 1;
    throw error;
  } finally {
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
    emitRootEnd(eventBus, exitCode);
    // Stop the reporter adapter after emitting root:end
    adapterController.stop();
  }
}
