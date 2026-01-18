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

async function setupNpmScriptTest(pkgJsonContent: string) {
  const projectRoot = path.join(process.cwd(), 'temp-npm-test');
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
    npmScripts: true,
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

describe('NPM Scripts Integration', () => {
  it('forwards extra arguments and unknown flags', async () => {
    const pkgJson = JSON.stringify({
      scripts: {
        hello: 'echo hello'
      }
    });

    const { config, cleanup } = await setupNpmScriptTest(pkgJson);
    
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
