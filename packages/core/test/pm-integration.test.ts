import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  run,
  createEventBus,
  createRawReporterAdapter,
  createRawPrompter,
} from '../src';
import * as path from 'path';
import { getRuntime } from '../src/runtime';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import * as os from 'os';

async function setupPmIntegrationTest(
  pkgJsonContent: string,
  extraConfig: { pmScripts?: boolean | string[]; pmCommands?: boolean | string[] } = {}
) {
  const projectRoot = path.join(process.cwd(), 'temp-pm-test');
  const commandsDir = path.join(projectRoot, 'commands');
  
  const runtime = await getRuntime();
  
  const originalReadFile = runtime.readFile;
  runtime.readFile = async (p: string) => {
    if (p.endsWith('package.json')) {
      return pkgJsonContent;
    }
    return originalReadFile(p);
  };

  const originalGlob = runtime.glob;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime.glob = async function* (pattern: string, options: any) {
    if (options?.cwd === commandsDir) {
      return;
    }
    yield* originalGlob(pattern, options);
  };

  const eventBus = createEventBus();
  const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
  const prompter = createRawPrompter({});

  const config = {
    commandsDir,
    projectRoot,
    appName: 'test-cli',
    reporterAdapter,
    prompter,
    ...extraConfig,
  };

  return { 
    config, 
    runtime, 
    cleanup: () => {
      runtime.readFile = originalReadFile;
      runtime.glob = originalGlob;
    }
  };
}

type WorkspaceFixture = {
  projectRoot: string;
  commandsDir: string;
  cleanup: () => Promise<void>;
};

async function setupWorkspaceFixture(options: {
  pm: 'pnpm' | 'bun' | 'npm' | 'yarn';
  scripts: Record<string, string>;
  workspaceName: string;
  workspaceScripts: Record<string, string>;
  withPokitConfig?: boolean;
}): Promise<WorkspaceFixture> {
  const { pm, scripts, workspaceName, workspaceScripts, withPokitConfig = true } = options;
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'pok-pm-'));
  const commandsDir = path.join(projectRoot, 'commands');
  const workspaceDir = path.join(projectRoot, 'packages', workspaceName);

  await mkdir(commandsDir, { recursive: true });
  await mkdir(workspaceDir, { recursive: true });

  await writeFile(
    path.join(projectRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'root',
        private: true,
        workspaces: ['packages/*'],
        scripts,
      },
      null,
      2
    )
  );

  await writeFile(
    path.join(workspaceDir, 'package.json'),
    JSON.stringify(
      {
        name: workspaceName,
        scripts: workspaceScripts,
      },
      null,
      2
    )
  );

  if (pm === 'pnpm') {
    await writeFile(
      path.join(projectRoot, 'pnpm-workspace.yaml'),
      ['packages:', '  - "packages/*"'].join('\n')
    );
    await writeFile(path.join(projectRoot, 'pnpm-lock.yaml'), '');
  } else if (pm === 'bun') {
    await writeFile(path.join(projectRoot, 'bun.lockb'), '');
  } else if (pm === 'yarn') {
    await writeFile(path.join(projectRoot, 'yarn.lock'), '');
  } else if (pm === 'npm') {
    await writeFile(path.join(projectRoot, 'package-lock.json'), '{}');
  }

  if (withPokitConfig) {
    await writeFile(path.join(projectRoot, 'pok.config.ts'), 'export default {};\n');
  }

  return {
    projectRoot,
    commandsDir,
    cleanup: async () => {
      await rm(projectRoot, { recursive: true, force: true });
    },
  };
}

describe('Package Manager Integration', () => {
  describe('pmScripts', () => {
    it('forwards extra arguments and unknown flags', async () => {
      const pkgJson = JSON.stringify({
        scripts: {
          hello: 'echo hello'
        }
      });

      const { config, cleanup } = await setupPmIntegrationTest(pkgJson, { pmScripts: true });
      
      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: string[][] = [];
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push(cmd);
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      try {
        await run(['hello', 'foo', '--bar=baz'], config);
        
        expect(spawnCalls.length).toBe(1);
        const fullCmd = spawnCalls[0].join(' ');
        expect(fullCmd).toContain('run hello -- foo --bar=baz');
      } finally {
        runtime.spawn = originalSpawn;
        cleanup();
      }
    });

    it('includes scripts matching glob patterns', async () => {
      const pkgJson = JSON.stringify({
        scripts: {
          'test:unit': 'echo unit',
          'test:e2e': 'echo e2e',
          'build': 'echo build',
          'lint': 'echo lint'
        }
      });

      const { config, cleanup } = await setupPmIntegrationTest(pkgJson, { pmScripts: ['test:*', 'build'] });
      
      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: string[][] = [];
      
      runtime.spawn = ((cmd: string[]) => {
        spawnCalls.push(cmd);
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      try {
        await run(['test', 'unit'], config);
        expect(spawnCalls[0].join(' ')).toContain('run test:unit');

        await run(['test', 'e2e'], config);
        expect(spawnCalls[1].join(' ')).toContain('run test:e2e');

        await run(['build'], config);
        expect(spawnCalls[2].join(' ')).toContain('run build');

        try {
          await run(['lint'], config);
          expect(true).toBe(false);
        } catch (e) {
          expect(String(e)).toContain('Unknown command: lint');
        }
      } finally {
        runtime.spawn = originalSpawn;
        cleanup();
      }
    });

    it('supports monorepo discovery with path globs', async () => {
      const rootPkgJson = JSON.stringify({
        scripts: { 'root-script': 'echo root' }
      });
      const pkgAPkgJson = JSON.stringify({
        name: 'pkg-a',
        scripts: { 'test': 'echo test-a' }
      });
      const pkgBPkgJson = JSON.stringify({
        name: 'pkg-b',
        scripts: { 'test': 'echo test-b' }
      });

      const projectRoot = path.join(process.cwd(), 'temp-monorepo-test');
      const commandsDir = path.join(projectRoot, 'commands');
      
      const runtime = await getRuntime();
      const originalReadFile = runtime.readFile;
      const originalGlob = runtime.glob;
      const originalSpawn = runtime.spawn;
      
      runtime.readFile = async (p: string) => {
        if (p === path.join(projectRoot, 'package.json')) return rootPkgJson;
        if (p === path.join(projectRoot, 'packages/pkg-a/package.json')) return pkgAPkgJson;
        if (p === path.join(projectRoot, 'packages/pkg-b/package.json')) return pkgBPkgJson;
        return originalReadFile(p);
      };

      runtime.glob = async function* (pattern: string, options: any) {
        if (pattern === 'packages/*/package.json') {
          yield 'packages/pkg-a/package.json';
          yield 'packages/pkg-b/package.json';
          return;
        }
        if (options?.cwd === commandsDir) return;
        yield* originalGlob(pattern, options);
      };

      const spawnCalls: { cmd: string; cwd: string }[] = [];
      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push({ cmd: cmd.join(' '), cwd: options.cwd });
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      const eventBus = createEventBus();
      const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
      const prompter = createRawPrompter({});

      const config = {
        commandsDir,
        projectRoot,
        appName: 'test-cli',
        reporterAdapter,
        prompter,
        pmScripts: ['root-script', 'packages/*'],
      };

      try {
        await run(['root-script'], config);
        expect(spawnCalls[0].cwd).toBe(projectRoot);

        await run(['pkg-a', 'test'], config);
        expect(spawnCalls[1].cwd).toBe(path.join(projectRoot, 'packages/pkg-a'));

        await run(['pkg-b', 'test'], config);
        expect(spawnCalls[2].cwd).toBe(path.join(projectRoot, 'packages/pkg-b'));
      } finally {
        runtime.readFile = originalReadFile;
        runtime.glob = originalGlob;
        runtime.spawn = originalSpawn;
      }
    });
  });

  describe('pmCommands', () => {
    it('supports built-in commands when true', async () => {
      const pkgJson = JSON.stringify({});
      const { config, cleanup } = await setupPmIntegrationTest(pkgJson, { pmCommands: true });
      
      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: string[][] = [];
      
      runtime.spawn = ((cmd: string[]) => {
        spawnCalls.push(cmd);
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      try {
        await run(['install'], config);
        expect(spawnCalls[0].join(' ')).toContain('install');
        expect(spawnCalls[0].join(' ')).not.toContain('run install');

        await run(['add', 'zod'], config);
        expect(spawnCalls[1].join(' ')).toContain('install zod');
      } finally {
        runtime.spawn = originalSpawn;
        cleanup();
      }
    });

    it('supports specific commands when array', async () => {
      const pkgJson = JSON.stringify({});
      const { config, cleanup } = await setupPmIntegrationTest(pkgJson, { pmCommands: ['audit'] });
      
      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: string[][] = [];
      
      runtime.spawn = ((cmd: string[]) => {
        spawnCalls.push(cmd);
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      try {
        await run(['audit'], config);
        expect(spawnCalls[0].join(' ')).toContain('audit');

        try {
          await run(['install'], config);
          expect(true).toBe(false);
        } catch (e) {
          expect(String(e)).toContain('Unknown command: install');
        }
      } finally {
        runtime.spawn = originalSpawn;
        cleanup();
      }
    });

    it('supports monorepo discovery for native commands', async () => {
      const rootPkgJson = JSON.stringify({});
      const pkgAPkgJson = JSON.stringify({ name: 'pkg-a' });
      const pkgBPkgJson = JSON.stringify({ name: 'pkg-b' });

      const projectRoot = path.join(process.cwd(), 'temp-monorepo-cmd-test');
      const commandsDir = path.join(projectRoot, 'commands');
      
      const runtime = await getRuntime();
      const originalReadFile = runtime.readFile;
      const originalGlob = runtime.glob;
      const originalSpawn = runtime.spawn;
      
      runtime.readFile = async (p: string) => {
        if (p === path.join(projectRoot, 'package.json')) return rootPkgJson;
        if (p === path.join(projectRoot, 'packages/pkg-a/package.json')) return pkgAPkgJson;
        if (p === path.join(projectRoot, 'packages/pkg-b/package.json')) return pkgBPkgJson;
        return originalReadFile(p);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runtime.glob = async function* (pattern: string, options: any) {
        if (pattern === 'packages/*/package.json') {
          yield 'packages/pkg-a/package.json';
          yield 'packages/pkg-b/package.json';
          return;
        }
        if (options?.cwd === commandsDir) return;
        yield* originalGlob(pattern, options);
      };

      const spawnCalls: { cmd: string; cwd: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push({ cmd: cmd.join(' '), cwd: options.cwd });
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      const eventBus = createEventBus();
      const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
      const prompter = createRawPrompter({});

      const config = {
        commandsDir,
        projectRoot,
        appName: 'test-cli',
        reporterAdapter,
        prompter,
        pmCommands: ['add', 'packages/*'],
      };

      try {
        await run(['add', 'zod'], config);
        expect(spawnCalls[0].cwd).toBe(projectRoot);
        expect(spawnCalls[0].cmd).toContain('install zod');

        await run(['pkg-a', 'add', 'zod'], config);
        expect(spawnCalls[1].cwd).toBe(path.join(projectRoot, 'packages/pkg-a'));
        expect(spawnCalls[1].cmd).toContain('install zod');

        await run(['pkg-b', 'add', 'zod'], config);
        expect(spawnCalls[2].cwd).toBe(path.join(projectRoot, 'packages/pkg-b'));
        expect(spawnCalls[2].cmd).toContain('install zod');
      } finally {
        runtime.readFile = originalReadFile;
        runtime.glob = originalGlob;
        runtime.spawn = originalSpawn;
      }
    });
  });

  describe('workspace proxy scripts', () => {
    it('creates submenu for pnpm -F workspace scripts', async () => {
      const { projectRoot, commandsDir, cleanup } = await setupWorkspaceFixture({
        pm: 'pnpm',
        scripts: {
          web: 'pnpm -F web',
          'web-dev': 'pnpm -F web dev',
        },
        workspaceName: 'web',
        workspaceScripts: { dev: 'echo dev', test: 'echo test' },
      });

      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: { cmd: string; cwd: string }[] = [];

      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push({ cmd: cmd.join(' '), cwd: options.cwd });
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      const config = {
        commandsDir,
        projectRoot,
        appName: 'test-cli',
        reporterAdapter: createRawReporterAdapter({ onEvent: () => {} }),
        prompter: createRawPrompter({}),
        pmScripts: true,
      };

      try {
        await run(['web', 'dev'], config);
        expect(spawnCalls[0].cmd).toContain('pnpm -F web dev');

        await run(['web-dev', 'test'], config);
        expect(spawnCalls[1].cmd).toContain('pnpm run web-dev -- test');
      } finally {
        runtime.spawn = originalSpawn;
        await cleanup();
      }
    });

    it('creates submenu for pnpm -C workspace scripts', async () => {
      const { projectRoot, commandsDir, cleanup } = await setupWorkspaceFixture({
        pm: 'pnpm',
        scripts: {
          web: 'pnpm -C packages/web',
        },
        workspaceName: 'web',
        workspaceScripts: { dev: 'echo dev' },
      });

      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: { cmd: string; cwd: string }[] = [];

      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push({ cmd: cmd.join(' '), cwd: options.cwd });
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      const config = {
        commandsDir,
        projectRoot,
        appName: 'test-cli',
        reporterAdapter: createRawReporterAdapter({ onEvent: () => {} }),
        prompter: createRawPrompter({}),
        pmScripts: true,
      };

      try {
        await run(['web', 'dev'], config);
        expect(spawnCalls[0].cmd).toContain('pnpm -C packages/web dev');
      } finally {
        runtime.spawn = originalSpawn;
        await cleanup();
      }
    });

    it('creates submenu for npm workspaces', async () => {
      const { projectRoot, commandsDir, cleanup } = await setupWorkspaceFixture({
        pm: 'npm',
        scripts: {
          web: 'npm -w web run',
          'web-dev': 'npm -w web run dev',
        },
        workspaceName: 'web',
        workspaceScripts: { dev: 'echo dev', test: 'echo test' },
      });

      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: { cmd: string; cwd: string }[] = [];

      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push({ cmd: cmd.join(' '), cwd: options.cwd });
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      const config = {
        commandsDir,
        projectRoot,
        appName: 'test-cli',
        reporterAdapter: createRawReporterAdapter({ onEvent: () => {} }),
        prompter: createRawPrompter({}),
        pmScripts: true,
      };

      try {
        await run(['web', 'dev'], config);
        expect(spawnCalls[0].cmd).toContain('npm -w web run dev');

        await run(['web-dev', 'test'], config);
        expect(spawnCalls[1].cmd).toContain('npm run web-dev -- test');
      } finally {
        runtime.spawn = originalSpawn;
        await cleanup();
      }
    });

    it('creates submenu for yarn workspaces', async () => {
      const { projectRoot, commandsDir, cleanup } = await setupWorkspaceFixture({
        pm: 'yarn',
        scripts: {
          web: 'yarn workspace web',
          'web-dev': 'yarn workspace web dev',
        },
        workspaceName: 'web',
        workspaceScripts: { dev: 'echo dev', test: 'echo test' },
      });

      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: { cmd: string; cwd: string }[] = [];

      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push({ cmd: cmd.join(' '), cwd: options.cwd });
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      const config = {
        commandsDir,
        projectRoot,
        appName: 'test-cli',
        reporterAdapter: createRawReporterAdapter({ onEvent: () => {} }),
        prompter: createRawPrompter({}),
        pmScripts: true,
      };

      try {
        await run(['web', 'dev'], config);
        expect(spawnCalls[0].cmd).toContain('yarn workspace web dev');

        await run(['web-dev', 'test'], config);
        expect(spawnCalls[1].cmd).toContain('yarn run web-dev -- test');
      } finally {
        runtime.spawn = originalSpawn;
        await cleanup();
      }
    });

    it('creates submenu for bun workspaces', async () => {
      const { projectRoot, commandsDir, cleanup } = await setupWorkspaceFixture({
        pm: 'bun',
        scripts: {
          web: 'bun -F web',
          'web-dev': 'bun -F web dev',
        },
        workspaceName: 'web',
        workspaceScripts: { dev: 'echo dev', test: 'echo test' },
      });

      const runtime = await getRuntime();
      const originalSpawn = runtime.spawn;
      const spawnCalls: { cmd: string; cwd: string }[] = [];

      runtime.spawn = ((cmd: string[], options: any) => {
        spawnCalls.push({ cmd: cmd.join(' '), cwd: options.cwd });
        return {
          exitCode: 0,
          killed: false,
          kill: () => {},
          exited: Promise.resolve(0),
          stdout: null,
          stderr: null,
        };
      }) as any;

      const config = {
        commandsDir,
        projectRoot,
        appName: 'test-cli',
        reporterAdapter: createRawReporterAdapter({ onEvent: () => {} }),
        prompter: createRawPrompter({}),
        pmScripts: true,
      };

      try {
        await run(['web', 'dev'], config);
        expect(spawnCalls[0].cmd).toContain('bun -F web dev');

        await run(['web-dev', 'test'], config);
        expect(spawnCalls[1].cmd).toContain('bun run web-dev -- test');
      } finally {
        runtime.spawn = originalSpawn;
        await cleanup();
      }
    });
  });

  describe('ignoreUnknownFlags', () => {
    it('allows unknown flags when enabled', async () => {
      const { parseContext } = await import('../src/lib/args');
      
      const contextDef = {
        known: {
          from: 'flag' as const,
          schema: z.string().default('default'),
        }
      };
  
      expect(() => parseContext(['--unknown'], contextDef)).toThrow(/Unknown flag/);
  
      const result = parseContext(['--unknown', 'val', '--known', 'yes'], contextDef, {
        ignoreUnknownFlags: true
      });
  
      expect(result.context.known).toBe('yes');
      expect(result.rest).toContain('--unknown');
      expect(result.rest).toContain('val');
    });
  });
});
