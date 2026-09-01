/**
 * End-to-end integration tests for create-pokit
 *
 * These tests verify that scaffolded projects work correctly by:
 * 1. Manually scaffolding projects (simulating what init.ts does)
 * 2. Linking local packages via file: (outside the monorepo workspace)
 * 3. Installing with pnpm as a standalone project
 *
 * Note: We don't run the actual init command directly in tests because
 * it spawns child processes that can hang in test environments. Instead,
 * we test the templates and file generation, then verify the output works.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { $ } from 'bun';
import {
  generatePackageJson,
  generateTsConfig,
  generateExampleCommand,
  generateBuildCommand,
  generateGitignore,
} from '../src/templates';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const LOCAL_PACKAGES: Record<string, string> = {
  '@pokit/core': path.join(WORKSPACE_ROOT, 'packages/core'),
  '@pokit/terminal': path.join(WORKSPACE_ROOT, 'packages/terminal'),
};

let TEST_PROJECTS_DIR: string;

function fileDep(pkgName: string): string {
  return `file:${LOCAL_PACKAGES[pkgName]}`;
}

function scaffoldProject(projectPath: string, options: { name: string; plugins: string[] }): void {
  fs.mkdirSync(projectPath, { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'commands'), { recursive: true });

  fs.writeFileSync(path.join(projectPath, 'package.json'), generatePackageJson(options));
  fs.writeFileSync(path.join(projectPath, 'tsconfig.json'), generateTsConfig());
  fs.writeFileSync(path.join(projectPath, '.gitignore'), generateGitignore());
  fs.writeFileSync(path.join(projectPath, 'commands', 'hello.ts'), generateExampleCommand());
  fs.writeFileSync(path.join(projectPath, 'commands', 'build.ts'), generateBuildCommand());
}

function patchPackageJsonForLocalPackages(projectPath: string): void {
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  for (const pkgName of Object.keys(LOCAL_PACKAGES)) {
    if (pkg.dependencies?.[pkgName]) {
      pkg.dependencies[pkgName] = fileDep(pkgName);
    }
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

async function pnpmInstall(projectPath: string): Promise<{ success: boolean; output: string }> {
  try {
    // Standalone install: these projects live outside the pok workspace so
    // pnpm must not walk up to the repo lockfile (which pulls @notation/docs
    // over git+ssh, unavailable in CI).
    const result = await $`pnpm install --ignore-workspace`.cwd(projectPath).nothrow();
    const output = result.stdout.toString() + '\n' + result.stderr.toString();
    return {
      success: result.exitCode === 0,
      output,
    };
  } catch (e: any) {
    return {
      success: false,
      output: e.stderr?.toString() || e.stdout?.toString() || e.message,
    };
  }
}

function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe('create-pokit end-to-end', () => {
  beforeAll(() => {
    TEST_PROJECTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-create-e2e-'));
  });

  afterAll(() => {
    cleanupDir(TEST_PROJECTS_DIR);
  });

  describe('project scaffolding', () => {
    it('creates all expected files with all plugins', () => {
      const projectName = 'test-all-plugins';
      const projectPath = path.join(TEST_PROJECTS_DIR, projectName);

      try {
        scaffoldProject(projectPath, {
          name: projectName,
          plugins: ['@pokit/terminal'],
        });

        expect(fs.existsSync(projectPath)).toBe(true);
        expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectPath, 'tsconfig.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectPath, '.gitignore'))).toBe(true);
        expect(fs.existsSync(path.join(projectPath, 'commands/hello.ts'))).toBe(true);
        expect(fs.existsSync(path.join(projectPath, 'commands/build.ts'))).toBe(true);

        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        expect(pkg.name).toBe(projectName);
        expect(pkg.dependencies['@pokit/core']).toBeDefined();
        expect(pkg.dependencies['@pokit/terminal']).toBeDefined();
      } finally {
        cleanupDir(projectPath);
      }
    });

    it('creates project with no plugins', () => {
      const projectName = 'test-no-plugins';
      const projectPath = path.join(TEST_PROJECTS_DIR, projectName);

      try {
        scaffoldProject(projectPath, {
          name: projectName,
          plugins: [],
        });

        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        expect(pkg.dependencies['@pokit/core']).toBeDefined();
        expect(pkg.dependencies['@pokit/terminal']).toBeUndefined();
      } finally {
        cleanupDir(projectPath);
      }
    });

    it('local package patching replaces versions correctly', () => {
      const projectName = 'test-workspace-patch';
      const projectPath = path.join(TEST_PROJECTS_DIR, projectName);

      try {
        scaffoldProject(projectPath, {
          name: projectName,
          plugins: ['@pokit/terminal'],
        });

        let pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        expect(pkg.dependencies['@pokit/core']).toBe('latest');

        patchPackageJsonForLocalPackages(projectPath);
        pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        expect(pkg.dependencies['@pokit/core']).toBe(fileDep('@pokit/core'));
        expect(pkg.dependencies['@pokit/terminal']).toBe(fileDep('@pokit/terminal'));
      } finally {
        cleanupDir(projectPath);
      }
    });
  });

  describe('scaffolded project dependencies', () => {
    it('installs successfully with workspace packages', async () => {
      const projectName = 'test-install';
      const projectPath = path.join(TEST_PROJECTS_DIR, projectName);

      try {
        scaffoldProject(projectPath, {
          name: projectName,
          plugins: ['@pokit/terminal'],
        });

        patchPackageJsonForLocalPackages(projectPath);

        const installResult = await pnpmInstall(projectPath);
        if (!installResult.success) {
          throw new Error(installResult.output);
        }
        expect(installResult.success).toBe(true);

        expect(fs.existsSync(path.join(projectPath, 'node_modules/@pokit/core'))).toBe(true);
      } finally {
        cleanupDir(projectPath);
      }
    }, 30000);
  });

  // Note: Direct command execution tests are skipped because bun's shell
  // has issues running nested bun processes in test environments.
  // The commands work correctly when run manually.

  describe('generated command content', () => {
    it('hello command uses correct reporter API', () => {
      const content = generateExampleCommand();

      expect(content).toContain('r.reporter.info');
      expect(content).not.toContain('r.log.info');
    });

    it('build command uses exec correctly', () => {
      const content = generateBuildCommand();

      expect(content).toContain('r.exec');
      expect(content).toContain('bun tsc');
    });
  });
});

describe('create-pokit workspace integration', () => {
  beforeAll(() => {
    TEST_PROJECTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-create-e2e-'));
  });

  afterAll(() => {
    cleanupDir(TEST_PROJECTS_DIR);
  });

  it('workspace packages can be installed via pnpm', async () => {
    const projectPath = path.join(TEST_PROJECTS_DIR, 'workspace-test');

    try {
      scaffoldProject(projectPath, {
        name: 'workspace-test',
        plugins: ['@pokit/terminal'],
      });

      patchPackageJsonForLocalPackages(projectPath);

      const installResult = await pnpmInstall(projectPath);
      if (!installResult.success) {
        throw new Error(installResult.output);
      }
      expect(installResult.success).toBe(true);

      expect(fs.existsSync(path.join(projectPath, 'node_modules/@pokit/core'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'node_modules/@pokit/terminal'))).toBe(
        true
      );
    } finally {
      cleanupDir(projectPath);
    }
  }, 30000);
});
