import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type {
  CommandConfig,
  CommandTree,
  MountContext,
  MountResult,
  Mountable,
  MountableLike,
} from './command';
import { getRuntime } from '../runtime';
import { parsePmCommand, resolveWorkspaceTarget, createPmAction, type ScriptInfo } from './pm';
import picomatch from 'picomatch';

// =============================================================================
// Composition & Helpers
// =============================================================================

/**
 * Stable stringify for deterministic IDs
 * Sorts object keys to ensure {a:1, b:2} === {b:2, a:1}
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(obj as object).sort();
  const entries = keys.map((k) => `"${k}":${stableStringify((obj as any)[k])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Resolve a MountableLike to a MountResult
 */
export async function resolveMountable(
  mountable: MountableLike,
  context: MountContext
): Promise<MountResult> {
  const result = await mountable(context);
  if (typeof result === 'function') {
    return result(context);
  }
  return result as MountResult;
}

/**
 * Compose multiple mountables into a single one.
 * Merges results sequentially (left-to-right).
 */
export function compose(...mountables: MountableLike[]): Mountable {
  return async (context: MountContext) => {
    const mergedTree: CommandTree = new Map();
    const sourceIds: string[] = [];

    for (const m of mountables) {
      const result = await resolveMountable(m, context);
      sourceIds.push(result.mountSourceId);

      // Merge tree
      for (const [key, node] of result.tree) {
        // Tag with provenance
        tagNodes(node, result.mountSourceId);

        if (mergedTree.has(key)) {
          throw new Error(`Command collision: "${key}" already exists at root composition`);
        }
        mergedTree.set(key, node);
      }
    }

    return {
      tree: mergedTree,
      mountSourceId: `compose(${sourceIds.join(',')})`,
    };
  };
}

/**
 * Recursively tag nodes with a source ID
 */
export function tagNodes(node: import('./command').CommandNode, sourceId: string): void {
  // Only tag if not already tagged (preserve original source in composition)
  if (!node.source) {
    node.source = sourceId;
  }
  for (const child of node.children.values()) {
    tagNodes(child, sourceId);
  }
}

// =============================================================================
// Built-in Mountables
// =============================================================================

/**
 * Helper to insert into tree
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
      node = {
        path: currentPath,
        segment,
        config: isLast ? config : { label: segment },
        children: new Map(),
      };
      currentLevel.set(segment, node);
    } else if (isLast) {
      node.config = config;
    }

    currentLevel = node.children;
  }
}

/**
 * Mount commands from a directory
 */
export function fromDirectory(dir: string): Mountable {
  return async (context: MountContext) => {
    const runtime = await getRuntime();
    const tree: CommandTree = new Map();

    if (fs.existsSync(dir)) {
      const files: string[] = [];
      for await (const file of runtime.glob('*.{ts,tsx}', { cwd: dir })) {
        if (file.startsWith('_')) continue;
        files.push(file);
      }

      // Sort files to ensure deterministic mount order
      files.sort();

      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const module = await import(filePath);
          if (!module.command) continue;

          const commandPath = file.replace(/\.tsx?$/, '');
          const segments = commandPath.split('.');
          const config = module.command as CommandConfig;

          insertIntoTree(tree, segments, config);
        } catch (e) {
          context.reporter.warn(
            `Failed to load command "${file}": ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }

    return {
      tree,
      mountSourceId: `dir:${dir}`,
    };
  };
}

/**
 * Mount commands from a relative path (ESM friendly)
 * @example mountFrom(import.meta.url, './admin')
 */
export function mountFrom(baseUrl: string, relativePath: string): Mountable {
  const dir = path.resolve(path.dirname(fileURLToPath(baseUrl)), relativePath);
  return fromDirectory(dir);
}

/**
 * Mount a static set of commands
 */
export function fromStatic(commands: Record<string, CommandConfig>): Mountable {
  return async () => {
    const tree: CommandTree = new Map();
    for (const [name, config] of Object.entries(commands)) {
      insertIntoTree(tree, name.split('.'), config);
    }
    return {
      tree,
      mountSourceId: `static:${stableStringify(Object.keys(commands))}`,
    };
  };
}

/**
 * Mount package manager scripts
 */
export function fromPackageScripts(config: boolean | string[], projectRoot: string): Mountable {
  return async (context) => {
    const tree: CommandTree = new Map();
    const runtime = await getRuntime();
    const { reporter } = context;

    try {
      const patterns = Array.isArray(config) ? config : [true];
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

        // Try matching against root package scripts
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
          // Ignore
        }

        // Try matching as a path glob for other package.jsons (monorepo support)
        if (pattern.includes('/') || pattern.includes('\\') || pattern.includes('*')) {
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

              for (const [scriptName, script] of Object.entries(pkg.scripts || {})) {
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
            // Ignore
          }
        }
      }

      let workspaceMap: Map<string, string> | null = null;

      for (const [commandPath, info] of allScripts) {
        const parsed = parsePmCommand(info.scriptContent);
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
            const hasExplicitScript =
              parsed.scriptToken !== null && parsed.scriptToken !== undefined;

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

              if (addedChild) continue;
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

    return {
      tree,
      mountSourceId: `pmScripts:${projectRoot}:${stableStringify(config)}`,
    };
  };
}

/**
 * Mount package manager native commands
 */
export function fromPackageCommands(config: boolean | string[], projectRoot: string): Mountable {
  return async () => {
    const tree: CommandTree = new Map();
    const runtime = await getRuntime();

    // Normalize commands list and discovery patterns
    const commands: string[] = [];
    const patterns: string[] = [];

    if (config === true) {
      commands.push('install', 'add', 'remove', 'update', 'audit', 'outdated');
    } else if (Array.isArray(config)) {
      for (const item of config) {
        if (item.includes('/') || item.includes('\\') || item.includes('*')) {
          patterns.push(item);
        } else {
          commands.push(item);
        }
      }
    }

    // 1. Register commands for root
    for (const cmd of commands) {
      const cmdConfig = createPmAction('exec', cmd, projectRoot);
      insertIntoTree(tree, [cmd], cmdConfig);
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
              const cmdConfig = createPmAction('exec', cmd, pkgDir);
              insertIntoTree(tree, commandPath.split(/[:.]/), cmdConfig);
            }
          }
        } catch {
          // Ignore glob errors
        }
      }
    }

    return {
      tree,
      mountSourceId: `pmCommands:${projectRoot}:${stableStringify(config)}`,
    };
  };
}

/**
 * No-op mountable
 */
export function noop(): Mountable {
  return () => ({ tree: new Map(), mountSourceId: 'noop' });
}
