/**
 * Integration tests for @openpok/create
 *
 * Tests the project scaffolding functionality.
 * Note: These tests verify file generation but skip dependency installation
 * since that requires network access and published packages.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generatePackageJson,
  generateTsConfig,
  generateExampleCommand,
  generateBuildCommand,
  generateGitignore,
} from '../../packages/create/src/templates';

describe('@openpok/create templates', () => {
  describe('generatePackageJson', () => {
    it('generates valid package.json with project name', () => {
      const config = {
        name: 'my-project',
        plugins: [],
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.name).toBe('my-project');
      expect(result.type).toBe('module');
      expect(result.version).toBe('0.0.1');
      expect(result.dependencies['@openpok/core']).toBe('latest');
    });

    it('includes selected plugins as dependencies', () => {
      const config = {
        name: 'my-project',
        plugins: ['@openpok/prompter-clack', '@openpok/reporter-clack'],
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.dependencies['@openpok/prompter-clack']).toBe('latest');
      expect(result.dependencies['@openpok/reporter-clack']).toBe('latest');
    });

    it('includes devDependencies', () => {
      const config = {
        name: 'my-project',
        plugins: [],
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.devDependencies['@types/bun']).toBe('latest');
    });

    it('includes pok script', () => {
      const config = {
        name: 'my-project',
        plugins: [],
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.scripts.pok).toBe('bun pok');
    });
  });

  describe('generateTsConfig', () => {
    it('generates valid tsconfig.json', () => {
      const result = JSON.parse(generateTsConfig());

      expect(result.compilerOptions.target).toBe('ESNext');
      expect(result.compilerOptions.module).toBe('ESNext');
      expect(result.compilerOptions.strict).toBe(true);
      expect(result.compilerOptions.noEmit).toBe(true);
    });

    it('includes correct paths', () => {
      const result = JSON.parse(generateTsConfig());

      expect(result.include).toContain('commands/**/*');
      expect(result.include).toContain('src/**/*');
    });
  });

  describe('generateExampleCommand', () => {
    it('generates valid hello command', () => {
      const result = generateExampleCommand();

      expect(result).toContain('defineCommand');
      expect(result).toContain("'@openpok/core'");
      expect(result).toContain('Say hello');
      expect(result).toContain('Hello from pok!');
    });
  });

  describe('generateBuildCommand', () => {
    it('generates valid build command', () => {
      const result = generateBuildCommand();

      expect(result).toContain('defineCommand');
      expect(result).toContain("'@openpok/core'");
      expect(result).toContain('Build project');
      expect(result).toContain('bun tsc');
    });
  });

  describe('generateGitignore', () => {
    it('generates valid .gitignore', () => {
      const result = generateGitignore();

      expect(result).toContain('node_modules/');
      expect(result).toContain('dist/');
    });
  });
});

describe('@openpok/create init command', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-create-test-'));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterEach(() => {
    // Clean up any created project directories
    const entries = fs.readdirSync(tempDir);
    for (const entry of entries) {
      const entryPath = path.join(tempDir, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    }
  });

  it('creates project directory structure manually', () => {
    const projectName = 'test-project';
    const projectPath = path.join(tempDir, projectName);
    const config = {
      name: projectName,
      plugins: ['@openpok/prompter-clack', '@openpok/reporter-clack'],
    };

    // Manually simulate what init.ts does (without bun install)
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'commands'), { recursive: true });

    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      generatePackageJson(config)
    );
    fs.writeFileSync(
      path.join(projectPath, 'tsconfig.json'),
      generateTsConfig()
    );
    fs.writeFileSync(
      path.join(projectPath, '.gitignore'),
      generateGitignore()
    );
    fs.writeFileSync(
      path.join(projectPath, 'commands', 'hello.ts'),
      generateExampleCommand()
    );
    fs.writeFileSync(
      path.join(projectPath, 'commands', 'build.ts'),
      generateBuildCommand()
    );

    // Verify structure
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'commands'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'commands', 'hello.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'commands', 'build.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, '.gitignore'))).toBe(true);

    // Verify content
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
    );
    expect(packageJson.name).toBe(projectName);
    expect(packageJson.dependencies['@openpok/prompter-clack']).toBeDefined();
    expect(packageJson.dependencies['@openpok/reporter-clack']).toBeDefined();
  });
});
