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

import { getRuntime, getPackageManager } from '../runtime';
import type { CommandConfig, CommandNode, CommandTree, HookContext } from './command';

import type { CheckConfig } from './check';
import { CheckError } from './check';
import {
  parseContext,
  resolveInteractiveContext,
  validateRequiredContext,
  extractChoices,
} from './args';
import { CLIError, type ErrorContext } from './cli-error';
import { findClosestMatch } from './string-distance';
import { createRunner, AbortError } from './runner';
import { generateHelp, generateRootHelp, hasHelpFlag, hasVersionFlag } from './help';
import {
  generateCompletionScript,
  generateCompletions,
  detectShell,
  getInstallInstructions,
  isValidShell,
  type Shell,
} from './completion';
import type { Prompter } from '../prompter';
import type { TabsAdapter } from '../tabs';
import type { ReporterAdapter, ReporterAdapterController, Reporter, EventBus } from '../events';
import { createEventBus, ScopedReporter } from '../events';

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
  /** Optional tabs adapter for tabbed console */
  tabs?: TabsAdapter;
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
  /** Optional tabs adapter */
  tabs?: TabsAdapter;
};

type ScriptInfo = {
  scriptName: string;
  cwd: string;
  scriptContent: string;
  requestArgs: boolean;
};

type ParsedPmCommand = {
  pm: 'pnpm' | 'bun' | 'npm' | 'yarn';
  targetName?: string;
  targetPath?: string;
  commandToken?: string | null;
  scriptToken?: string | null;
};

function hasPokitConfig(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'pok.config.ts'));
}

function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parsePmCommand(scriptContent: string): ParsedPmCommand | null {
  const tokens = tokenizeCommand(scriptContent);
  if (tokens.length === 0) return null;

  const pm = tokens[0];
  if (pm !== 'pnpm' && pm !== 'bun' && pm !== 'npm' && pm !== 'yarn') return null;

  if (pm === 'yarn' && tokens[1] === 'workspace') {
    const targetName = tokens[2];
    if (!targetName) return null;
    const commandToken = tokens[3] ?? null;
    return {
      pm,
      targetName,
      commandToken,
      scriptToken: commandToken,
    };
  }

  let filterValue: string | undefined;
  let workspaceValue: string | undefined;
  let commandPathValue: string | undefined;
  const nonFlagTokens: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token === '--') break;

    if (token.startsWith('--filter=')) {
      filterValue = token.slice('--filter='.length);
      continue;
    }
    if (token === '--filter') {
      filterValue = tokens[i + 1];
      i++;
      continue;
    }
    if (token.startsWith('--command=')) {
      commandPathValue = token.slice('--command='.length);
      continue;
    }
    if (token === '--command') {
      commandPathValue = tokens[i + 1];
      i++;
      continue;
    }
    if (token.startsWith('--workspace=')) {
      workspaceValue = token.slice('--workspace='.length);
      continue;
    }
    if (token === '--workspace') {
      workspaceValue = tokens[i + 1];
      i++;
      continue;
    }

    if (token.startsWith('-F')) {
      filterValue = token.length > 2 ? token.slice(2) : tokens[i + 1];
      if (token.length === 2) i++;
      continue;
    }
    if (token.startsWith('-C')) {
      commandPathValue = token.length > 2 ? token.slice(2) : tokens[i + 1];
      if (token.length === 2) i++;
      continue;
    }
    if (token.startsWith('-w')) {
      workspaceValue = token.length > 2 ? token.slice(2) : tokens[i + 1];
      if (token.length === 2) i++;
      continue;
    }

    if (token.startsWith('-')) continue;

    nonFlagTokens.push(token);
  }

  let commandToken: string | null = null;
  let scriptToken: string | null = null;
  if (nonFlagTokens.length > 0) {
    if (nonFlagTokens[0] === 'run' || nonFlagTokens[0] === 'run-script') {
      commandToken = nonFlagTokens[0];
      scriptToken = nonFlagTokens[1] ?? null;
    } else {
      commandToken = nonFlagTokens[0];
      scriptToken = nonFlagTokens[0];
    }
  }

  if (pm === 'pnpm' || pm === 'bun') {
    return {
      pm,
      targetName: commandPathValue ? undefined : filterValue,
      targetPath: commandPathValue,
      commandToken,
      scriptToken,
    };
  }

  if (pm === 'npm') {
    return {
      pm,
      targetName: workspaceValue,
      targetPath: commandPathValue,
      commandToken,
      scriptToken,
    };
  }

  return {
    pm,
    targetName: workspaceValue,
    targetPath: commandPathValue,
    commandToken,
    scriptToken,
  };
}

async function loadPackageInfo(
  pkgDir: string,
  runtime: any
): Promise<{ name: string | null; scripts: Record<string, unknown> } | null> {
  try {
    const content = await runtime.readFile(path.join(pkgDir, 'package.json'));
    const pkg = JSON.parse(content);
    return {
      name: typeof pkg.name === 'string' ? pkg.name : null,
      scripts: pkg.scripts || {},
    };
  } catch {
    return null;
  }
}

async function resolveWorkspaceTarget(
  parsed: ParsedPmCommand,
  infoCwd: string,
  projectRoot: string,
  runtime: any,
  workspaceMap: Map<string, string> | null
): Promise<{
  targetDir: string;
  targetName: string | null;
  scripts: Record<string, unknown>;
  workspaceMap: Map<string, string> | null;
} | null> {
  if (parsed.targetPath) {
    const absPath = path.isAbsolute(parsed.targetPath)
      ? parsed.targetPath
      : path.resolve(infoCwd, parsed.targetPath);
    const pkgDir = absPath.endsWith('package.json') ? path.dirname(absPath) : absPath;
    const pkgInfo = await loadPackageInfo(pkgDir, runtime);
    if (!pkgInfo) return null;
    return {
      targetDir: pkgDir,
      targetName: pkgInfo.name || path.basename(pkgDir),
      scripts: pkgInfo.scripts,
      workspaceMap,
    };
  }

  if (parsed.targetName) {
    if (!workspaceMap) {
      workspaceMap = await buildWorkspaceMap(projectRoot, runtime);
    }
    const targetDir = workspaceMap.get(parsed.targetName);
    if (!targetDir) return null;
    const pkgInfo = await loadPackageInfo(targetDir, runtime);
    if (!pkgInfo) return null;
    return {
      targetDir,
      targetName: pkgInfo.name || parsed.targetName,
      scripts: pkgInfo.scripts,
      workspaceMap,
    };
  }

  return null;
}

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

/**
 * Load all command files and build a command tree
 */
export async function buildCommandTree(
  commandsDir: string,
  ctx: RouterContext
): Promise<CommandTree> {
  const tree: CommandTree = new Map();
  const runtime = await getRuntime();
  const { reporter } = ctx;

  // 1. Add package manager scripts (pmScripts)
  const scriptsConfig = ctx.config.pmScripts;
  if (scriptsConfig) {
    const projectRoot = ctx.projectRoot;
    const { reporter } = ctx;
    const enableWorkspaceSubmenus = hasPokitConfig(projectRoot);

    try {
      const patterns = Array.isArray(scriptsConfig) ? scriptsConfig : [true];

      const allScripts = new Map<string, ScriptInfo>();

      for (const pattern of patterns) {
        if (typeof pattern === 'boolean') {
          if (pattern === true) {
            const rootPkgPath = path.join(projectRoot, 'package.json');
            try {
              const content = await runtime.readFile(rootPkgPath);
              const pkg = JSON.parse(content);
              for (const [name, script] of Object.entries(pkg.scripts || {})) {
                if (name !== 'preinstall') {
                  const scriptStr = typeof script === 'string' ? script : '';
                  allScripts.set(name, {
                    scriptName: name,
                    cwd: projectRoot,
                    scriptContent: scriptStr,
                    requestArgs: scriptStr.trim().endsWith(' --'),
                  });
                }
              }
            } catch {
              // Ignore
            }
          }
          continue;
        }

        // 1. Try matching against root package scripts
        try {
          const rootPkgContent = await runtime.readFile(path.join(projectRoot, 'package.json'));
          const rootPkg = JSON.parse(rootPkgContent);
          const rootScripts = rootPkg.scripts || {};

          if (rootScripts[pattern]) {
            const script = rootScripts[pattern];
            const scriptStr = typeof script === 'string' ? script : '';
            allScripts.set(pattern, {
              scriptName: pattern,
              cwd: projectRoot,
              scriptContent: scriptStr,
              requestArgs: scriptStr.trim().endsWith(' --'),
            });
          } else if (!pattern.includes('/')) {
            // Only try script name glob if there's no slash (avoid confusion with paths)
            const isMatch = picomatch(pattern);
            for (const [name, script] of Object.entries(rootScripts)) {
              if (isMatch(name)) {
                const scriptStr = typeof script === 'string' ? script : '';
                allScripts.set(name, {
                  scriptName: name,
                  cwd: projectRoot,
                  scriptContent: scriptStr,
                  requestArgs: scriptStr.trim().endsWith(' --'),
                });
              }
            }
          }
        } catch {
          // Root package.json might not exist or be invalid, ignore
        }

        // 2. Try matching as a path glob for other package.jsons (monorepo support)
        if (pattern.includes('/') || pattern.includes('\\') || pattern.includes('*')) {
          let globPattern = pattern;
          // If it doesn't end in package.json, assume it's a directory pattern
          if (!pattern.endsWith('package.json')) {
            globPattern = pattern.endsWith('/')
              ? `${pattern}package.json`
              : `${pattern}/package.json`;
          }

          try {
            for await (const pkgPath of runtime.glob(globPattern, { cwd: projectRoot })) {
              // Skip root package.json if it was already handled as true or matched above
              if (pkgPath === 'package.json') continue;

              const absPath = path.join(projectRoot, pkgPath);
              const content = await runtime.readFile(absPath);
              const pkg = JSON.parse(content);
              const pkgName = pkg.name || path.basename(path.dirname(pkgPath));
              const pkgDir = path.dirname(absPath);

              for (const [scriptName, script] of Object.entries(pkg.scripts || {})) {
                // Use package name as prefix for workspace scripts
                const commandPath = `${pkgName}:${scriptName}`;
                const scriptStr = typeof script === 'string' ? script : '';
                allScripts.set(commandPath, {
                  scriptName,
                  cwd: pkgDir,
                  scriptContent: scriptStr,
                  requestArgs: scriptStr.trim().endsWith(' --'),
                });
              }
            }
          } catch {
            // Ignore glob errors
          }
        }
      }

      let workspaceMap: Map<string, string> | null = null;

      for (const [commandPath, info] of allScripts) {
        const parsed = enableWorkspaceSubmenus ? parsePmCommand(info.scriptContent) : null;
        if (parsed) {
          const resolved = await resolveWorkspaceTarget(
            parsed,
            info.cwd,
            projectRoot,
            runtime,
            workspaceMap
          );
          if (resolved) {
            workspaceMap = resolved.workspaceMap;
            const targetScripts = resolved.scripts || {};
            const scriptNames = Object.keys(targetScripts);

            const hasCommand = parsed.commandToken !== null && parsed.commandToken !== undefined;
            const isRunCommand =
              parsed.commandToken === 'run' || parsed.commandToken === 'run-script';
            const hasExplicitScript = parsed.scriptToken !== null && parsed.scriptToken !== undefined;

            const shouldCreateSubmenu =
              scriptNames.length > 0 && (!hasCommand || (isRunCommand && !hasExplicitScript));

            if (shouldCreateSubmenu) {
              const segments = commandPath.split(/[:.]/);
              const parentConfig: CommandConfig = {
                label: info.scriptName,
                description: `Proxy to ${resolved.targetName} scripts`,
              };
              insertIntoTree(tree, segments, parentConfig);

              let addedChild = false;
              for (const [childName, childScript] of Object.entries(targetScripts)) {
                const childSegments = [...segments, childName];

                const childConfig: CommandConfig = {
                  label: childName,
                  description: typeof childScript === 'string' ? childScript : `Run ${childName}`,
                  ignoreUnknownFlags: true,
                  run: async (r, ctx) => {
                    const args = ctx.extraArgs.length > 0 ? ` ${ctx.extraArgs.join(' ')}` : '';
                    const fullCmd = `${info.scriptContent} ${childName}${args}`;
                    await r.exec(fullCmd, {
                      interactive: true,
                      cwd: info.cwd,
                      env: {
                        npm_config_recursive: undefined,
                      },
                    });
                  },
                };
                insertIntoTree(tree, childSegments, childConfig);
                addedChild = true;
              }

              if (addedChild) {
                continue;
              }
            }
          }
        }

        const config = createPmAction('run', info.scriptName, info.cwd, info.requestArgs);
        const segments = commandPath.split(/[:.]/);
        insertIntoTree(tree, segments, config);
      }
    } catch (error) {
      reporter.warn(
        `Failed to load scripts: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // 2. Add native package manager commands
  if (ctx.config.pmCommands) {
    const projectRoot = ctx.projectRoot;
    const commandsConfig = ctx.config.pmCommands;

    // Normalize commands list and discovery patterns
    const commands: string[] = [];
    const patterns: string[] = [];

    if (commandsConfig === true) {
      commands.push('install', 'add', 'remove', 'update', 'audit', 'outdated');
    } else if (Array.isArray(commandsConfig)) {
      for (const item of commandsConfig) {
        if (item.includes('/') || item.includes('\\') || item.includes('*')) {
          patterns.push(item);
        } else {
          commands.push(item);
        }
      }
    }

    // 1. Register commands for root
    for (const cmd of commands) {
      const config = createPmAction('exec', cmd, projectRoot);
      insertIntoTree(tree, [cmd], config);
    }

    // 2. Register commands for workspaces if patterns exist
    if (patterns.length > 0) {
      for (const pattern of patterns) {
        let globPattern = pattern;
        if (!pattern.endsWith('package.json')) {
          globPattern = pattern.endsWith('/')
            ? `${pattern}package.json`
            : `${pattern}/package.json`;
        }

        try {
          for await (const pkgPath of runtime.glob(globPattern, { cwd: projectRoot })) {
            if (pkgPath === 'package.json') continue;

            const absPath = path.join(projectRoot, pkgPath);
            const content = await runtime.readFile(absPath);
            const pkg = JSON.parse(content);
            const pkgName = pkg.name || path.basename(path.dirname(pkgPath));
            const pkgDir = path.dirname(absPath);

            for (const cmd of commands) {
              const commandPath = `${pkgName}:${cmd}`;
              const config = createPmAction('exec', cmd, pkgDir);
              insertIntoTree(tree, commandPath.split(/[:.]/), config);
            }
          }
        } catch {
          // Ignore glob errors
        }
      }
    }
  }

  // 3. Add extra commands
  if (ctx.config.extraCommands) {
    for (const [name, config] of Object.entries(ctx.config.extraCommands)) {
      insertIntoTree(tree, name.split('.'), config);
    }
  }

  // 4. Load file-based commands
  if (fs.existsSync(commandsDir)) {
    for await (const file of runtime.glob('*.{ts,tsx}', { cwd: commandsDir })) {
      // Skip non-command files
      if (file.startsWith('_')) continue;

      const filePath = path.join(commandsDir, file);

      try {
        const module = await import(filePath);

        if (!module.command) {
          // File doesn't export a command - skip
          continue;
        }

        // Convert filename to command path
        // e.g., 'generate.types.cloudflare.ts' -> ['generate', 'types', 'cloudflare']
        const commandPath = file.replace(/\.tsx?$/, '');
        const segments = commandPath.split('.');

        const config = module.command as CommandConfig;

        // Warn if command has conflicting configuration
        if (config.run && config.enableRunAllChildren) {
          reporter.warn(
            `Command "${commandPath}" has both 'run' and 'enableRunAllChildren'. ` +
              `The 'enableRunAllChildren' option will be ignored.`
          );
        }

        // Insert into tree
        insertIntoTree(tree, segments, config);
      } catch (error) {
        // Log with actionable guidance - allows partial loading
        const errorMessage = error instanceof Error ? error.message : String(error);
        reporter.error(
          `Failed to load command "${file}":\n` +
            `  ${errorMessage}\n\n` +
            `To fix this:\n` +
            `  1. Ensure the file exports a valid command: export const command = defineCommand({ ... })\n` +
            `  2. Check for syntax errors or missing imports in the file\n` +
            `  3. Verify all referenced tasks and checks are properly defined`
        );
      }
    }
  }

  // Validate aliases after building the tree

  validateAliases(tree);

  return tree;
}

/**
 * Create a command that runs a package manager action (script or command)
 *
 * @internal
 * @param type - 'run' for scripts (pm run x), 'exec' for native commands (pm x)
 * @param name - The script name or command name
 * @param cwd - Working directory for the command
 * @returns Command configuration
 */
function createPmAction(
  type: 'run' | 'exec',
  name: string,
  cwd: string,
  requestArgs: boolean = false
): CommandConfig {
  const pm = getPackageManager(cwd);
  const isPnpmWorkspace = pm === 'pnpm' && fs.existsSync(path.join(cwd, 'pnpm-workspace.yaml'));
  const isYarnWorkspace =
    pm === 'yarn' &&
    fs.existsSync(path.join(cwd, 'package.json')) &&
    (() => {
      try {
        return !!JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8')).workspaces;
      } catch {
        return false;
      }
    })();

  // Map logical command names to PM-specific commands
  let actualName = name;
  let flags = '';

  if (type === 'exec') {
    if (pm === 'npm') {
      if (name === 'add') actualName = 'install';
      if (name === 'remove') actualName = 'uninstall';
    } else if (pm === 'yarn') {
      if (name === 'update') actualName = 'upgrade';
      // Yarn v1 needs -W for root commands in workspace
      if (isYarnWorkspace && ['add', 'remove', 'upgrade', 'install'].includes(actualName)) {
        flags = ' -W';
      }
    } else if (pm === 'bun') {
      if (name === 'audit') actualName = 'pm audit';
    } else if (pm === 'pnpm') {
      // pnpm needs -w for root commands in workspace
      if (isPnpmWorkspace && ['add', 'install', 'remove', 'update'].includes(actualName)) {
        flags = ' -w';
      }
    }
  }

  const description = type === 'run' ? `${pm} run ${name}` : `${pm} ${actualName}${flags}`;

  return {
    label: name,
    description,
    ignoreUnknownFlags: true,
    requestArgs,
    run: async (r, ctx) => {
      const pm = getPackageManager(cwd);
      // Ensure we have args if requested (handled by executeLeaf logic now)
      const args =
        ctx.extraArgs.length > 0
          ? type === 'run'
            ? ` -- ${ctx.extraArgs.join(' ')}`
            : ` ${ctx.extraArgs.join(' ')}`
          : '';
      const cmd =
        type === 'run' ? `${pm} run ${name}${args}` : `${pm} ${actualName}${flags}${args}`;
      await r.exec(cmd, {
        interactive: true,
        cwd,
        env: {
          npm_config_recursive: undefined,
        },
      });
    },
  };
}

/**
 * Insert a command into the tree, creating intermediate nodes as needed.

 *
 * Walks the segment path (e.g., ['generate', 'types', 'cloudflare']) and creates
 * tree nodes as necessary. Intermediate nodes get a placeholder config with just
 * a label. The final segment receives the actual command config.
 *
 * @internal
 * @param tree - The command tree to insert into
 * @param segments - Path segments from the command filename (e.g., 'foo.bar.ts' -> ['foo', 'bar'])
 * @param config - The command configuration to attach to the leaf node
 */
function insertIntoTree(tree: CommandTree, segments: string[], config: CommandConfig): void {
  let currentLevel = tree;
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    currentPath = currentPath ? `${currentPath}.${segment}` : segment;
    const isLast = i === segments.length - 1;

    let node = currentLevel.get(segment);

    if (!node) {
      // Create new node
      node = {
        path: currentPath,
        segment,
        config: isLast ? config : { label: segment },
        children: new Map(),
      };
      currentLevel.set(segment, node);
    } else if (isLast) {
      // Update existing node with actual config
      node.config = config;
    }

    currentLevel = node.children;
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
 * Discover all workspace packages and return a map of name -> path
 */
async function buildWorkspaceMap(projectRoot: string, runtime: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const patterns: string[] = [];

  // 1. Try pnpm-workspace.yaml
  try {
    const pnpmPath = path.join(projectRoot, 'pnpm-workspace.yaml');
    const content = await runtime.readFile(pnpmPath);
    // Simple YAML array extraction (handles 'packages/*' and "packages/*")
    const matches = content.matchAll(/-\s+['"]?([^'"\n]+)['"]?/g);
    for (const m of matches) patterns.push(m[1]);
  } catch {
    // Ignore
  }

  // 2. Try package.json workspaces
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const content = await runtime.readFile(pkgPath);
    const pkg = JSON.parse(content);
    if (Array.isArray(pkg.workspaces)) {
      patterns.push(...pkg.workspaces);
    } else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
      patterns.push(...pkg.workspaces.packages);
    }
  } catch {
    // Ignore
  }

  // Default fallback if no patterns found
  if (patterns.length === 0) {
    patterns.push('packages/*', 'apps/*');
  }

  // 3. Scan directories
  for (const pattern of patterns) {
    // Convert dir glob to package.json glob
    let globPattern = pattern;
    if (!pattern.endsWith('package.json')) {
      globPattern = pattern.endsWith('/') ? `${pattern}package.json` : `${pattern}/package.json`;
    }

    try {
      for await (const pkgPath of runtime.glob(globPattern, { cwd: projectRoot })) {
        if (pkgPath === 'package.json') continue; // Skip root

        const absPath = path.join(projectRoot, pkgPath);
        const pkgDir = path.dirname(absPath);

        try {
          const content = await runtime.readFile(absPath);
          const pkg = JSON.parse(content);
          if (pkg.name) {
            map.set(pkg.name, pkgDir);
          }
        } catch {
          // Skip invalid package.json
        }
      }
    } catch {
      // Ignore glob errors
    }
  }

  return map;
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
    for (const child of n.children.values()) {
      traverse(child);
    }
  };

  traverse(node);
  return leaves;
}

/**
 * Resolve checks from a command's pre configuration
 */
async function resolveChecks(
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
 * This ensures that when checks fail, the failure event includes remediation steps.
 */
async function executeCheck(check: CheckConfig): Promise<void> {
  try {
    await check.check();
  } catch (originalError) {
    // Normalize remediation to array
    const remediation = check.remediation
      ? Array.isArray(check.remediation)
        ? check.remediation
        : [check.remediation]
      : undefined;

    // Use custom errorMessage if provided, otherwise use original error message
    const errorMessage =
      check.errorMessage ||
      (originalError instanceof Error ? originalError.message : String(originalError));

    // Throw a CheckError with remediation info
    throw new CheckError(errorMessage, {
      remediation,
      documentationUrl: check.documentationUrl,
    });
  }
}

/**
 * Run pre-checks for a command.
 *
 * Resolves checks from the command's `pre` configuration, creates a "Pre-flight Checks"
 * group, and executes each check as an activity. Handles error wrapping with remediation info.
 *
 * @param config - The command configuration containing pre-checks
 * @param hookContext - The hook context for dynamic check resolution
 * @param reporter - The reporter for emitting events
 */
async function runPreChecks(
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
 * Run an array of pre-checks as a single group.
 *
 * Used for batch execution scenarios where checks have been collected and deduplicated.
 * Creates a "Pre-flight Checks" group and executes each check as an activity.
 *
 * @param checks - Array of check configurations to execute
 * @param reporter - The reporter for emitting events
 */
async function runChecksGroup(checks: CheckConfig[], reporter: Reporter): Promise<void> {
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
  menuOpen: boolean = false
): Promise<void> {
  const { config } = node;
  const { reporter } = ctx;

  // If node has a run function, execute it
  if (config.run) {
    await executeLeaf(node, args, ctx, { fromMenu, menuOpen });
    return;
  }

  // Parent node - show submenu of children
  const children = Array.from(node.children.values());

  if (children.length === 0) {
    throw new RouterError(`Command "${node.path}" has no implementation or children`);
  }

  if (ctx.config.noTty) {
    const helpText = generateHelp({
      commandPath: node.path.split('.'),
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
      await showParentSubmenu(node, tree, args, ctx, true);
    });
    return;
  }

  // Already in a group - show submenu directly
  await showParentSubmenu(node, tree, args, ctx, menuOpen);
}

/**
 * Show submenu for a parent node and handle selection
 */
async function showParentSubmenu(
  node: CommandNode,
  tree: CommandTree,
  args: string[],
  ctx: RouterContext,
  menuOpen: boolean
): Promise<void> {
  const { config } = node;
  const { reporter, prompter } = ctx;
  const children = Array.from(node.children.values());

  // Build menu options
  const options: Array<{ value: string; label: string }> = [];

  // Add "all" option if enabled
  if (config.enableRunAllChildren) {
    options.push({
      value: '__all__',
      label: 'all - Run all commands',
    });
  }

  // Add child commands
  for (const child of children.sort((a, b) => a.segment.localeCompare(b.segment))) {
    const description = child.config.description || child.config.label;
    options.push({
      value: child.segment,
      label: `${child.segment} - ${description}`,
    });
  }

  const selected = await prompter.select({
    message: `Select ${node.segment}:`,
    options,
  });

  if (selected === '__all__') {
    // Close menu group before running all children
    reporter.success('Selected');
    await executeAllChildren(node, args, ctx, true, false);
    return;
  }

  const selectedChild = node.children.get(String(selected));
  if (!selectedChild) {
    throw new RouterError(`Child command not found: ${String(selected)}`);
  }

  // Recurse into selected child (menu stays open through navigation)
  await executeNode(selectedChild, tree, args, ctx, true, menuOpen);
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
  const { projectRoot, reporter, prompter, eventBus, tabs, appName } = ctx;

  // Check if already aborted before starting
  if (signal?.aborted) {
    throw new AbortError();
  }

  // Build error context for rich error messages
  const errorContext: ErrorContext = {
    appName,
    commandPath: node.path.split('.'),
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
    extraArgs,
    cwd: projectRoot,
  };

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
      tabs,
      prompter,
    });
    await config.run(runner, runCtx);
  }
}

/**
 * Resolved context for a leaf node
 */
type LeafWithContext = {
  node: CommandNode;
  resolvedContext: Record<string, unknown>;
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
      commandPath: leaf.path.split('.'),
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
  projectRoot: string
): Promise<CheckConfig[]> {
  const seen = new Set<CheckConfig>();
  const allChecks: CheckConfig[] = [];

  for (const { node: leaf, resolvedContext, extraArgs } of leavesWithContext) {
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
  quiet: boolean
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
        leavesWithContext.map(async ({ node: leaf, resolvedContext, extraArgs }) => {
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
  menuOpen: boolean = false
): Promise<void> {
  const mode = node.config.enableRunAllChildren;
  const { reporter, projectRoot } = ctx;

  if (!mode) {
    throw new RouterError('enableRunAllChildren not configured');
  }

  const leaves = getLeafNodes(node);

  if (leaves.length === 0) {
    throw new RouterError(`No executable children found under "${node.path}"`);
  }

  // Close menu if open before running multiple commands
  if (menuOpen) {
    reporter.success('Selected');
  }

  const quiet = node.config.quietRunAll !== false;

  // Phase 1: Resolve context for each leaf
  const leavesWithContext = await resolveChildrenContexts(leaves, args, ctx, fromMenu);

  // Phase 2: Collect all pre-checks
  const allChecks = await collectPreChecks(leavesWithContext, projectRoot);

  // Phase 3: Run all pre-checks in one group
  await runChecksGroup(allChecks, reporter);

  // Phase 4: Run all leaves as activities within a single group
  await executeChildrenGroup(node, leavesWithContext, ctx, quiet);
}

/**
 * Execute a leaf command with pre-resolved context.
 * Used when context has already been resolved (e.g., from menu selection).
 */
async function executeLeafWithContext(
  node: CommandNode,
  resolvedContext: Record<string, unknown>,
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
  const { projectRoot, reporter, prompter, eventBus, tabs } = ctx;

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
    extraArgs: finalArgs,
    cwd: projectRoot,
  };

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
      tabs,
      prompter,
    });
    await config.run(runner, runCtx);
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
  resolvedContext: Record<string, unknown>,
  extraArgs: string[],
  ctx: RouterContext
): Promise<void> {
  const mode = node.config.enableRunAllChildren;
  const { reporter, projectRoot } = ctx;

  if (!mode) {
    throw new RouterError('enableRunAllChildren not configured');
  }

  const leaves = getLeafNodes(node);

  if (leaves.length === 0) {
    throw new RouterError(`No executable children found under "${node.path}"`);
  }

  const quiet = node.config.quietRunAll !== false;

  // Phase 1: Collect all pre-checks (deduplicated by reference, preserving order)
  // All leaves share the same resolvedContext in this path
  const seen = new Set<CheckConfig>();
  const allChecks: CheckConfig[] = [];

  for (const leaf of leaves) {
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
type MenuSelectionResult = {
  node: CommandNode;
  context: Record<string, unknown>;
  extraArgs: string[];
};

/**
 * Format a breadcrumb trail for display.
 * Shows the app name followed by the navigation path, joined by ' > '.
 *
 * @param appName - The CLI application name
 * @param path - The current navigation path segments
 * @returns Formatted breadcrumb string (empty if at root level)
 */
function formatBreadcrumb(appName: string, path: string[]): string {
  if (path.length === 0) return '';
  const parts = [appName, ...path];
  return parts.join(' > ');
}

/**
 * Handle interactive menu selection, including any context prompts.
 * Returns the selected node and resolved context, or null if selection fails.
 * This function handles ONLY the selection phase - execution happens afterward.
 */
async function selectFromMenu(
  tree: CommandTree,
  ctx: RouterContext
): Promise<MenuSelectionResult | null> {
  const { reporter, prompter, appName } = ctx;
  const topLevel = Array.from(tree.values()).sort((a, b) => a.segment.localeCompare(b.segment));

  if (topLevel.length === 0) {
    reporter.error('No commands available');
    return null;
  }

  // Menu selection wrapped in a group - this closes BEFORE execution
  return reporter.group(appName, { layout: 'sequence' }, async () => {
    // Navigate through the menu tree until we reach a leaf or runAllChildren
    let currentNode: CommandNode | null = null;
    let runAll = false;
    // Track the navigation path for breadcrumb display
    const navigationPath: string[] = [];

    // Initial selection
    const selected = await prompter.select({
      message: 'What would you like to do?',
      options: topLevel.map((node) => {
        const description = node.config.description || node.config.label;
        return {
          value: node.segment,
          label: `${node.segment} - ${description}`,
        };
      }),
    });

    currentNode = tree.get(String(selected)) ?? null;

    if (!currentNode) {
      reporter.error(`Command not found: ${String(selected)}`);
      return null;
    }

    // Add the selected node to the navigation path
    navigationPath.push(currentNode.segment);

    // Navigate through parent nodes until we reach a leaf
    while (currentNode && !currentNode.config.run && !runAll) {
      const children = Array.from(currentNode.children.values());

      if (children.length === 0) {
        reporter.error(`Command "${currentNode.path}" has no implementation or children`);
        return null;
      }

      // Build menu options
      const options: Array<{ value: string; label: string }> = [];

      // Add "all" option if enabled
      if (currentNode.config.enableRunAllChildren) {
        options.push({
          value: '__all__',
          label: 'all - Run all commands',
        });
      }

      // Add child commands
      for (const child of children.sort((a, b) => a.segment.localeCompare(b.segment))) {
        const description = child.config.description || child.config.label;
        options.push({
          value: child.segment,
          label: `${child.segment} - ${description}`,
        });
      }

      // Show breadcrumb before submenu selection
      const breadcrumb = formatBreadcrumb(appName, navigationPath);
      if (breadcrumb) {
        reporter.info(breadcrumb);
      }

      const childSelected = await prompter.select({
        message: `Select ${currentNode.segment}:`,
        options,
      });

      if (childSelected === '__all__') {
        runAll = true;
      } else {
        const nextNode = currentNode.children.get(String(childSelected));
        if (!nextNode) {
          reporter.error(`Child command not found: ${String(childSelected)}`);
          return null;
        }
        currentNode = nextNode;
        // Update navigation path with the new selection
        navigationPath.push(nextNode.segment);
      }
    }

    // Now resolve context for the selected command
    const config = currentNode.config;
    const contextDef = config.context || {};
    const errorContext: ErrorContext = {
      appName,
      commandPath: currentNode.path.split('.'),
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
      node: currentNode,
      context: resolvedContext,
      extraArgs: parsed.rest,
    };
  });
}

/**
 * Show interactive menu and run selected command
 */
async function runMenu(tree: CommandTree, ctx: RouterContext): Promise<void> {
  // Phase 1: Selection (wrapped in group, closes after selection)
  const selection = await selectFromMenu(tree, ctx);

  if (!selection) {
    throw new RouterError('No command selected');
  }

  const { node, context, extraArgs } = selection;

  // Phase 2: Execution (happens OUTSIDE the menu group)
  // Check if this is a "run all children" scenario
  if (!node.config.run && node.config.enableRunAllChildren) {
    await executeAllChildrenWithContext(node, context, extraArgs, ctx);
    return;
  }

  // Execute the leaf command with pre-resolved context
  await executeLeafWithContext(node, context, extraArgs, ctx);
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

/**
 * Main router entry point
 *
 * @param args - Command line arguments (without 'node' and script name)
 * @param config - Router configuration
 */
export async function run(args: string[], config: RouterConfig): Promise<void> {
  const { commandsDir, projectRoot, appName, reporterAdapter } = config;

  // Version check first - before any reporter setup or command tree building
  if (hasVersionFlag(args)) {
    const resolvedAppName = appName ?? path.basename(projectRoot);
    const version = config.version ?? (await discoverVersion(projectRoot));

    if (version) {
      console.log(`${resolvedAppName} ${version}`);
    } else {
      console.log(resolvedAppName);
    }

    return;
  }

  // Create event bus and start reporter adapter
  const eventBus = createEventBus();
  const adapterController = reporterAdapter.start(eventBus);
  const reporter = new ScopedReporter(eventBus, 'root', 'root');
  const resolvedAppName = appName ?? path.basename(projectRoot);

  // Build the router context with all runtime state
  const ctx: RouterContext = {
    config,
    eventBus,
    reporter,
    adapterController,
    appName: resolvedAppName,
    projectRoot,
    prompter: config.prompter,
    tabs: config.tabs,
  };

  try {
    // Build command tree
    const tree = await buildCommandTree(commandsDir, ctx);

    // Handle hidden __complete command for dynamic shell completions
    if (args[0] === '__complete') {
      const completionArgs = args.slice(1);
      const completions = generateCompletions(completionArgs, tree);
      console.log(completions.join('\n'));
      return;
    }

    // Handle completion script generation command
    if (args[0] === 'completion') {
      const shellArg = args[1];
      const shell: Shell = shellArg && isValidShell(shellArg) ? shellArg : detectShell();

      const script = generateCompletionScript(resolvedAppName, shell);
      console.log(script);
      console.error('');
      console.error(getInstallInstructions(resolvedAppName, shell));
      return;
    }

    // Check for --help or -h flag at root level (before any command)
    if (args.length === 0 || (args.length > 0 && hasHelpFlag(args) && !findNode(tree, args))) {
      // No command specified, just --help - show root help
      if (hasHelpFlag(args)) {
        const topLevelCommands = Array.from(tree.values());
        const helpText = generateRootHelp({
          appName: resolvedAppName,
          commands: topLevelCommands,
        });
        console.log(helpText);
        return;
      }
      if (args.length === 0 && config.noTty) {
        const topLevelCommands = Array.from(tree.values());
        const helpText = generateRootHelp({
          appName: resolvedAppName,
          commands: topLevelCommands,
        });
        console.log(helpText);
        return;
      }
      // No arguments - show interactive menu
      await runMenu(tree, ctx);
      return;
    }

    // Find command by path (filtering out help flags for matching)
    const argsWithoutHelp = args.filter((a) => a !== '--help' && a !== '-h');
    const match = findNode(tree, argsWithoutHelp);

    // Check for help flag - intercept before normal execution
    if (hasHelpFlag(args)) {
      if (!match) {
        // Unknown command with --help - show root help
        const topLevelCommands = Array.from(tree.values());
        const helpText = generateRootHelp({
          appName: resolvedAppName,
          commands: topLevelCommands,
        });
        console.log(helpText);
        return;
      }

      // Show help for the matched command
      const children = Array.from(match.node.children.values());
      const commandPath = match.node.path.split('.');
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
      const unknownCommand = args[0];
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
      await executeAllChildren(match.node, remainingArgs.slice(1), ctx, false);
      return;
    }

    // Execute the command with remaining args
    await executeNode(match.node, tree, match.remainingArgs, ctx);
  } catch (error) {
    // Format CLIError with usage hints
    if (error instanceof CLIError) {
      console.error(error.format());
      throw new RouterError(error.message);
    }
    throw error;
  } finally {
    // Stop the reporter adapter when done
    adapterController.stop();
  }
}
