import * as fs from 'fs';
import * as path from 'path';
import type { CommandConfig } from './command';
import { detectPackageManagerFromLockfile } from '../runtime';

export type ParsedPmCommand = {
  pm: 'pnpm' | 'bun' | 'npm' | 'yarn';
  targetName?: string;
  targetPath?: string;
  commandToken?: string | null;
  scriptToken?: string | null;
};

export type ScriptInfo = {
  scriptName: string;
  cwd: string;
  scriptContent: string;
  requestArgs: boolean;
};

export function tokenizeCommand(input: string): string[] {
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
      const next = input[i + 1];
      if (next === undefined) {
        current += char;
        continue;
      }

      // In shell syntax, backslash escapes whitespace/quotes/backslash.
      // Keep literal backslashes (e.g. Windows paths) when not escaping.
      if (quote || /\s|["'\\]/.test(next)) {
        escaped = true;
      } else {
        current += char;
      }
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

export function parsePmCommand(scriptContent: string): ParsedPmCommand | null {
  const tokens = tokenizeCommand(scriptContent);
  if (tokens.length === 0) return null;

  const pm = tokens[0];
  if (pm !== 'pnpm' && pm !== 'bun' && pm !== 'npm' && pm !== 'yarn') return null;

  if (pm === 'yarn' && tokens[1] === 'workspace') {
    const targetName = tokens[2];
    if (!targetName) return null;
    const commandToken = tokens[3] ?? null;
    const scriptToken =
      commandToken === 'run' || commandToken === 'run-script' ? (tokens[4] ?? null) : commandToken;
    return {
      pm,
      targetName,
      commandToken,
      scriptToken,
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

export async function loadPackageInfo(
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

/**
 * Discover all workspace packages and return a map of name -> path
 */
export async function buildWorkspaceMap(
  projectRoot: string,
  runtime: any
): Promise<Map<string, string>> {
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

export async function resolveWorkspaceTarget(
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
 * Create a command that runs a package manager action (script or command)
 *
 * @internal
 * @param type - 'run' for scripts (pm run x), 'exec' for native commands (pm x)
 * @param name - The script name or command name
 * @param cwd - Working directory for the command
 * @returns Command configuration
 */
export function createPmAction(
  type: 'run' | 'exec',
  name: string,
  cwd: string,
  requestArgs: boolean = false
): CommandConfig {
  const pm = detectPackageManagerFromLockfile(cwd);
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
  const flagTokens: string[] = [];

  if (type === 'exec') {
    if (pm === 'npm') {
      if (name === 'add') actualName = 'install';
      if (name === 'remove') actualName = 'uninstall';
    } else if (pm === 'yarn') {
      if (name === 'update') actualName = 'upgrade';
      // Yarn v1 needs -W for root commands in workspace
      if (isYarnWorkspace && ['add', 'remove', 'upgrade', 'install'].includes(actualName)) {
        flagTokens.push('-W');
      }
    } else if (pm === 'bun') {
      if (name === 'audit') actualName = 'pm audit';
    } else if (pm === 'pnpm') {
      // pnpm needs -w for root commands in workspace
      if (isPnpmWorkspace && ['add', 'install', 'remove', 'update'].includes(actualName)) {
        flagTokens.push('-w');
      }
    }
  }

  const description =
    type === 'run'
      ? `${pm} run ${name}`
      : `${pm} ${actualName}${flagTokens.length > 0 ? ` ${flagTokens.join(' ')}` : ''}`;

  return {
    label: name,
    description,
    ignoreUnknownFlags: true,
    requestArgs,
    run: async (r, ctx) => {
      const pm = detectPackageManagerFromLockfile(cwd);
      const actualCommandTokens = actualName.split(' ');
      const cmd =
        type === 'run'
          ? [pm, 'run', name, ...(ctx.extraArgs.length > 0 ? ['--', ...ctx.extraArgs] : [])]
          : [pm, ...actualCommandTokens, ...flagTokens, ...ctx.extraArgs];
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
