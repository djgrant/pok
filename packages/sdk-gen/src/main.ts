import * as fs from 'fs';
import * as path from 'path';

import { createEventBus, createRawPrompter, createRawReporterAdapter, createRootReporter, emitRootEnd } from '@pokit/core';
import { validateConfig, findConfigFile } from '@pokit/core';
import { buildCommandTree } from '@pokit/core';
import type { CommandNode, CommandTree } from '@pokit/core';

export type ImportExtensionMode = 'preserve' | 'ts' | 'js';

export type GenerateSdkOptions = {
  config?: string;
  out?: string;
  importExtension?: ImportExtensionMode;
  includePm?: boolean;
  cwd?: string;
};

function findConfigInDir(dir: string): { configPath: string; configDir: string } | null {
  const configPath = path.join(dir, 'pok.config.ts');
  if (fs.existsSync(configPath)) return { configPath, configDir: dir };
  const dotConfigPath = path.join(dir, '.config', 'pok.config.ts');
  if (fs.existsSync(dotConfigPath)) return { configPath: dotConfigPath, configDir: dir };
  return null;
}

function resolveConfigTarget(
  target: string | undefined,
  cwd: string
): { configPath: string; configDir: string } {
  if (!target) {
    const found = findConfigFile(cwd);
    if (!found) {
      throw new Error('No pok.config.ts found (use --config)');
    }
    return found;
  }

  const abs = path.resolve(cwd, target);
  if (!fs.existsSync(abs)) {
    throw new Error(`Config target not found: ${abs}`);
  }
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    return { configPath: abs, configDir: path.dirname(abs) };
  }
  if (stat.isDirectory()) {
    const found = findConfigInDir(abs);
    if (!found) throw new Error(`No pok.config.ts found at ${abs}`);
    return found;
  }
  throw new Error(`Invalid --config target: ${abs}`);
}

function toImportSpecifier(fromDir: string, fileAbs: string, mode: ImportExtensionMode): string {
  const rel = path.relative(fromDir, fileAbs);
  const relPosix = rel.split(path.sep).join('/');
  const noExt = relPosix.replace(/\.[jt]sx?$/, '');

  const base = noExt.startsWith('.') ? noExt : `./${noExt}`;
  if (mode === 'preserve') return base;
  if (mode === 'ts') return `${base}.ts`;
  return `${base}.js`;
}

function isValidIdent(s: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);
}

const RESERVED = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

function propAccess(seg: string): { key: string; access: string } {
  if (isValidIdent(seg) && !RESERVED.has(seg)) {
    return { key: seg, access: `.${seg}` };
  }
  const key = JSON.stringify(seg);
  return { key, access: `[${key}]` };
}

type LeafInfo = {
  path: string[];
  file?: string;
  projectRoot?: string;
};

type TypeTree = {
  children: Map<string, TypeTree>;
  methodType?: string;
};

function collectLeaves(tree: CommandTree): LeafInfo[] {
  const out: LeafInfo[] = [];

  const walk = (node: CommandNode) => {
    if (node.config.run) {
      out.push({ path: node.path, file: node.file, projectRoot: node.projectRoot });
    }
    for (const child of node.children.values()) walk(child);
  };

  for (const node of tree.values()) walk(node);
  out.sort((a, b) => a.path.join('.').localeCompare(b.path.join('.')));
  return out;
}

function propKey(seg: string): string {
  if (isValidIdent(seg) && !RESERVED.has(seg)) return seg;
  return JSON.stringify(seg);
}

function buildTypeTree(
  leaves: Array<LeafInfo & { importName?: string; untyped: boolean }>
): TypeTree {
  const root: TypeTree = { children: new Map() };

  for (const leaf of leaves) {
    let cur = root;
    for (let i = 0; i < leaf.path.length; i++) {
      const seg = leaf.path[i]!;
      const isLast = i === leaf.path.length - 1;
      if (!cur.children.has(seg)) cur.children.set(seg, { children: new Map() });
      cur = cur.children.get(seg)!;
      if (isLast) {
        if (leaf.untyped) {
          cur.methodType = `(_opts?: { args?: string[] }) => Promise<void>`;
        } else {
          const cmd = leaf.importName!;
          cur.methodType =
            `(context?: OptionalizeUndefined<CommandContextInput<typeof ${cmd}>>, ` +
            `opts?: { args?: string[]; cwd?: string; globalContext?: Record<string, unknown> }) => ` +
            `Promise<CommandReturn<typeof ${cmd}>>`;
        }
      }
    }
  }

  return root;
}

function renderTypeTree(node: TypeTree, indent: string): string {
  const lines: string[] = [];
  lines.push('{');

  const entries = Array.from(node.children.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [seg, child] of entries) {
    const key = propKey(seg);
    if (child.methodType) {
      lines.push(`${indent}  ${key}: ${child.methodType};`);
    } else {
      lines.push(`${indent}  ${key}: ${renderTypeTree(child, indent + '  ')};`);
    }
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function buildClientObjectSource(
  leaves: Array<LeafInfo & { importName?: string; relCwd: string; untyped: boolean }>
): string {
  // Build nested object structure.
  // We render as a series of assignments into a plain object for simplicity.
  const lines: string[] = [];
  lines.push('  const client: any = {};');

  for (const leaf of leaves) {
    let cursor = 'client';
    for (let i = 0; i < leaf.path.length; i++) {
      const seg = leaf.path[i]!;
      const { access } = propAccess(seg);
      const isLast = i === leaf.path.length - 1;
      if (!isLast) {
        lines.push(`  ${cursor}${access} ??= {};`);
        cursor = `${cursor}${access}`;
        continue;
      }

      if (leaf.untyped) {
        lines.push(
          `  ${cursor}${access} = async (opts?: { args?: string[]; cwd?: string; globalContext?: Record<string, unknown> }) => {`
        );
        lines.push(`    const tree = await __getTree();`);
        lines.push(
          `    const node = __findNode(tree, ${JSON.stringify(leaf.path)});`
        );
        lines.push(
          `    const cwd = opts?.cwd ?? path.resolve(__sdkDir, ${JSON.stringify(leaf.relCwd)});`
        );
        lines.push(
          `    return runtime.invoke(node.config, { cwd, args: opts?.args, globalContext: opts?.globalContext }) as Promise<void>;`
        );
        lines.push(`  };`);
      } else {
        const cmd = leaf.importName!;
        lines.push(
          `  ${cursor}${access} = async (context?: OptionalizeUndefined<CommandContextInput<typeof ${cmd}>>, opts?: { args?: string[]; cwd?: string; globalContext?: Record<string, unknown> }) => {`
        );
        lines.push(
          `    return runtime.invoke(${cmd}, { cwd: opts?.cwd ?? path.resolve(__sdkDir, ${JSON.stringify(
            leaf.relCwd
          )}), context, args: opts?.args, globalContext: opts?.globalContext }) as Promise<CommandReturn<typeof ${cmd}>>;`
        );
        lines.push('  };');
      }
    }
  }

  lines.push('  client.close = () => runtime.close();');
  lines.push('  return client as Client;');
  return lines.join('\n');
}

export type GenerateSdkResult = {
  outPath: string;
  configPath: string;
  commandCount: number;
  typedCommandCount: number;
  untypedCommandCount: number;
};

export async function generateSdk(opts: GenerateSdkOptions = {}): Promise<GenerateSdkResult> {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const { configPath, configDir } = resolveConfigTarget(opts.config, cwd);
  const rawConfigMod = await import(configPath);
  const resolved = validateConfig(rawConfigMod.default, configPath);

  const appDir = path.resolve(configDir, resolved.appDir);
  const commandsDir = path.resolve(appDir, resolved.commandsDir);
  const projectRoot = path.resolve(configDir, resolved.cwd);

  const outPath = path.resolve(configDir, opts.out ?? './pok.sdk.gen.ts');
  const outDir = path.dirname(outPath);

  const importExt: ImportExtensionMode = opts.importExtension ?? 'preserve';
  const includePm = opts.includePm ?? false;

  const eventBus = createEventBus();
  const reporterAdapter = createRawReporterAdapter();
  const adapterController = reporterAdapter.start(eventBus);
  const reporter = createRootReporter(eventBus, resolved.appName ?? 'pok', resolved.version);
  const prompter = createRawPrompter();

  const routerConfig = {
    commandsDir,
    projectRoot,
    appName: resolved.appName,
    version: resolved.version,
    reporterAdapter,
    prompter,
    tabs: resolved.tabs,
    pmScripts: includePm ? resolved.pmScripts : undefined,
    pmCommands: includePm ? resolved.pmCommands : undefined,
    plugins: resolved.plugins,
  };

  const ctx = {
    config: routerConfig,
    eventBus,
    reporter,
    adapterController,
    appName: routerConfig.appName ?? 'pok',
    projectRoot,
    prompter,
    globalContext: {},
  };

  const tree = await buildCommandTree(commandsDir, ctx as any);

  emitRootEnd(eventBus, 0);
  adapterController.stop();

  const leaves = collectLeaves(tree);

  const typedLeaves = leaves.filter((l) => typeof l.file === 'string');
  const importMap = new Map<string, string>(); // fileAbs -> importName
  typedLeaves.forEach((leaf, i) => {
    importMap.set(leaf.file!, `cmd_${i}`);
  });

  const resolvedLeaves = leaves
    .filter((l) => includePm || l.file) // when includePm=false, drop untyped leaves entirely
    .map((leaf) => {
      const cwdAbs = leaf.projectRoot ?? projectRoot;
      const relCwd = path.relative(outDir, cwdAbs).split(path.sep).join('/');
      const untyped = !leaf.file;
      return {
        ...leaf,
        importName: leaf.file ? importMap.get(leaf.file) : undefined,
        relCwd: relCwd.startsWith('.') ? relCwd : `./${relCwd}`,
        untyped,
      };
    });

  const importLines: string[] = [];
  importLines.push(`import * as path from 'path';`);
  importLines.push(`import { fileURLToPath } from 'url';`);
  importLines.push(
    `import { createSdkRuntime } from '@pokit/core';`
  );
  importLines.push(
    `import type { SdkRuntimeOptions, CommandContextInput, CommandReturn, OptionalizeUndefined } from '@pokit/core';`
  );

  const hasUntyped = resolvedLeaves.some((l) => l.untyped);
  if (hasUntyped) {
    importLines.push(
      `import { buildCommandTree, validateConfig, createEventBus, createRawReporterAdapter, createRawPrompter, createRootReporter } from '@pokit/core';`
    );
    importLines.push(`import type { CommandTree, CommandNode } from '@pokit/core';`);
  }

  for (const [fileAbs, importName] of importMap) {
    const spec = toImportSpecifier(outDir, fileAbs, importExt);
    importLines.push(`import { command as ${importName} } from ${JSON.stringify(spec)};`);
  }

  const typeTree = buildTypeTree(resolvedLeaves as any);
  const clientType = `export type Client = ${renderTypeTree(
    {
      children: new Map<string, TypeTree>([
        ['close', { children: new Map(), methodType: `() => void` }],
        ...Array.from(typeTree.children.entries()),
      ]),
    },
    ''
  )};`;

  const body: string[] = [];
  body.push(importLines.join('\n'));
  body.push('');
  body.push(`const __sdkDir = path.dirname(fileURLToPath(import.meta.url));`);
  if (hasUntyped) {
    const configRel = path
      .relative(outDir, configPath)
      .split(path.sep)
      .join('/');
    const configSpec = configRel.startsWith('.') ? configRel : `./${configRel}`;

    body.push('');
    body.push(`const __configUrl = new URL(${JSON.stringify(configSpec)}, import.meta.url);`);
    body.push(`let __treePromise: Promise<CommandTree> | null = null;`);
    body.push('');
    body.push(`async function __getTree(): Promise<CommandTree> {`);
    body.push(`  if (__treePromise) return __treePromise;`);
    body.push(`  __treePromise = (async () => {`);
    body.push(`    const raw = await import(__configUrl.href);`);
    body.push(`    const cfg = validateConfig(raw.default, fileURLToPath(__configUrl));`);
    body.push(`    const configDir = path.dirname(fileURLToPath(__configUrl));`);
    body.push(`    const appDir = path.resolve(configDir, cfg.appDir);`);
    body.push(`    const commandsDir = path.resolve(appDir, cfg.commandsDir);`);
    body.push(`    const projectRoot = path.resolve(configDir, cfg.cwd);`);
    body.push(`    const eventBus = createEventBus();`);
    body.push(`    const reporterAdapter = createRawReporterAdapter();`);
    body.push(`    const adapterController = reporterAdapter.start(eventBus);`);
    body.push(`    const reporter = createRootReporter(eventBus, cfg.appName ?? 'pok', cfg.version);`);
    body.push(`    const prompter = createRawPrompter();`);
    body.push(`    const routerConfig = {`);
    body.push(`      commandsDir,`);
    body.push(`      projectRoot,`);
    body.push(`      appName: cfg.appName,`);
    body.push(`      version: cfg.version,`);
    body.push(`      reporterAdapter,`);
    body.push(`      prompter,`);
    body.push(`      tabs: cfg.tabs,`);
    body.push(`      pmScripts: cfg.pmScripts,`);
    body.push(`      pmCommands: cfg.pmCommands,`);
    body.push(`      plugins: cfg.plugins,`);
    body.push(`    };`);
    body.push(`    const ctx: any = {`);
    body.push(`      config: routerConfig,`);
    body.push(`      eventBus,`);
    body.push(`      reporter,`);
    body.push(`      adapterController,`);
    body.push(`      appName: routerConfig.appName ?? 'pok',`);
    body.push(`      projectRoot,`);
    body.push(`      prompter,`);
    body.push(`      globalContext: {},`);
    body.push(`    };`);
    body.push(`    try {`);
    body.push(`      return await buildCommandTree(commandsDir, ctx);`);
    body.push(`    } finally {`);
    body.push(`      adapterController.stop();`);
    body.push(`    }`);
    body.push(`  })();`);
    body.push(`  return __treePromise;`);
    body.push(`}`);
    body.push('');
    body.push(`function __findNode(tree: CommandTree, segments: string[]): CommandNode {`);
    body.push(`  let level: CommandTree = tree;`);
    body.push(`  let node: CommandNode | undefined;`);
    body.push(`  for (const seg of segments) {`);
    body.push(`    node = level.get(seg);`);
    body.push(`    if (!node) throw new Error(\`Command not found: \${segments.join('.')}\`);`);
    body.push(`    level = node.children;`);
    body.push(`  }`);
    body.push(`  if (!node) throw new Error(\`Command not found: \${segments.join('.')}\`);`);
    body.push(`  return node;`);
    body.push(`}`);
  }
  body.push('');
  body.push(clientType);
  body.push('');
  body.push(`export function createClient(options: SdkRuntimeOptions = {}): Client {`);
  body.push(`  const runtime = createSdkRuntime(options);`);
  body.push(buildClientObjectSource(resolvedLeaves as any));
  body.push(`}`);
  body.push('');
  body.push(`export type { SdkRuntimeOptions };`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body.join('\n'), 'utf8');

  return {
    outPath,
    configPath,
    commandCount: resolvedLeaves.length,
    typedCommandCount: resolvedLeaves.filter((leaf) => !leaf.untyped).length,
    untypedCommandCount: resolvedLeaves.filter((leaf) => leaf.untyped).length,
  };
}
