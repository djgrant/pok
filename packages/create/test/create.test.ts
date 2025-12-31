/**
 * Integration tests for @pokit/create
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
  TEMPLATES,
  TEMPLATE_NAMES,
  AVAILABLE_PLUGINS,
} from '../src/templates';

describe('@pokit/create templates', () => {
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
      expect(result.dependencies['@pokit/core']).toBe('latest');
    });

    it('includes selected plugins as dependencies', () => {
      const config = {
        name: 'my-project',
        plugins: ['@pokit/prompter-clack', '@pokit/reporter-clack'],
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.dependencies['@pokit/prompter-clack']).toBe('latest');
      expect(result.dependencies['@pokit/reporter-clack']).toBe('latest');
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
      expect(result).toContain("'@pokit/core'");
      expect(result).toContain('Say hello');
      expect(result).toContain('Hello from pok!');
    });
  });

  describe('generateBuildCommand', () => {
    it('generates valid build command', () => {
      const result = generateBuildCommand();

      expect(result).toContain('defineCommand');
      expect(result).toContain("'@pokit/core'");
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

describe('@pokit/create init command', () => {
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
      plugins: ['@pokit/prompter-clack', '@pokit/reporter-clack'],
    };

    // Manually simulate what init.ts does (without bun install)
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'commands'), { recursive: true });

    fs.writeFileSync(path.join(projectPath, 'package.json'), generatePackageJson(config));
    fs.writeFileSync(path.join(projectPath, 'tsconfig.json'), generateTsConfig());
    fs.writeFileSync(path.join(projectPath, '.gitignore'), generateGitignore());
    fs.writeFileSync(path.join(projectPath, 'commands', 'hello.ts'), generateExampleCommand());
    fs.writeFileSync(path.join(projectPath, 'commands', 'build.ts'), generateBuildCommand());

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
    expect(packageJson.dependencies['@pokit/prompter-clack']).toBeDefined();
    expect(packageJson.dependencies['@pokit/reporter-clack']).toBeDefined();
  });
});

describe('@pokit/create template presets', () => {
  describe('TEMPLATES constant', () => {
    it('has all four template types', () => {
      expect(TEMPLATES).toHaveLength(4);
      expect(TEMPLATE_NAMES).toEqual(['starter', 'minimal', 'full', 'custom']);
    });

    it('has starter template with correct plugins', () => {
      const starter = TEMPLATES.find((t) => t.name === 'starter');
      expect(starter).toBeDefined();
      expect(starter!.label).toBe('Starter (recommended)');
      expect(starter!.plugins).toEqual(['@pokit/prompter-clack', '@pokit/reporter-clack']);
    });

    it('has minimal template with no plugins', () => {
      const minimal = TEMPLATES.find((t) => t.name === 'minimal');
      expect(minimal).toBeDefined();
      expect(minimal!.label).toBe('Minimal');
      expect(minimal!.plugins).toEqual([]);
    });

    it('has full template with all plugins', () => {
      const full = TEMPLATES.find((t) => t.name === 'full');
      expect(full).toBeDefined();
      expect(full!.label).toBe('Full');
      expect(full!.plugins).toEqual([
        '@pokit/prompter-clack',
        '@pokit/reporter-clack',
        '@pokit/tabs-ink',
      ]);
    });

    it('has custom template with empty plugins array', () => {
      const custom = TEMPLATES.find((t) => t.name === 'custom');
      expect(custom).toBeDefined();
      expect(custom!.label).toBe('Custom');
      expect(custom!.plugins).toEqual([]);
    });

    it('all templates have required properties', () => {
      for (const template of TEMPLATES) {
        expect(template.name).toBeDefined();
        expect(template.label).toBeDefined();
        expect(template.hint).toBeDefined();
        expect(Array.isArray(template.plugins)).toBe(true);
      }
    });
  });

  describe('AVAILABLE_PLUGINS constant', () => {
    it('has all three plugins', () => {
      expect(AVAILABLE_PLUGINS).toHaveLength(3);
    });

    it('has prompter-clack plugin', () => {
      const prompter = AVAILABLE_PLUGINS.find((p) => p.value === '@pokit/prompter-clack');
      expect(prompter).toBeDefined();
      expect(prompter!.label).toBe('Prompter (clack)');
    });

    it('has reporter-clack plugin', () => {
      const reporter = AVAILABLE_PLUGINS.find((p) => p.value === '@pokit/reporter-clack');
      expect(reporter).toBeDefined();
      expect(reporter!.label).toBe('Reporter (clack)');
    });

    it('has tabs-ink plugin', () => {
      const tabs = AVAILABLE_PLUGINS.find((p) => p.value === '@pokit/tabs-ink');
      expect(tabs).toBeDefined();
      expect(tabs!.label).toBe('Tabs (ink)');
    });

    it('all plugins have required properties', () => {
      for (const plugin of AVAILABLE_PLUGINS) {
        expect(plugin.value).toBeDefined();
        expect(plugin.label).toBeDefined();
        expect(plugin.hint).toBeDefined();
      }
    });
  });

  describe('starter template', () => {
    it('includes prompter-clack and reporter-clack plugins', () => {
      const starter = TEMPLATES.find((t) => t.name === 'starter')!;
      const config = {
        name: 'starter-project',
        plugins: starter.plugins,
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.dependencies['@pokit/prompter-clack']).toBe('latest');
      expect(result.dependencies['@pokit/reporter-clack']).toBe('latest');
      expect(result.dependencies['@pokit/tabs-ink']).toBeUndefined();
    });
  });

  describe('minimal template', () => {
    it('includes only core with no plugins', () => {
      const minimal = TEMPLATES.find((t) => t.name === 'minimal')!;
      const config = {
        name: 'minimal-project',
        plugins: minimal.plugins,
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.dependencies['@pokit/core']).toBe('latest');
      expect(result.dependencies['@pokit/prompter-clack']).toBeUndefined();
      expect(result.dependencies['@pokit/reporter-clack']).toBeUndefined();
      expect(result.dependencies['@pokit/tabs-ink']).toBeUndefined();
    });
  });

  describe('full template', () => {
    it('includes all plugins including tabs-ink', () => {
      const full = TEMPLATES.find((t) => t.name === 'full')!;
      const config = {
        name: 'full-project',
        plugins: full.plugins,
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.dependencies['@pokit/prompter-clack']).toBe('latest');
      expect(result.dependencies['@pokit/reporter-clack']).toBe('latest');
      expect(result.dependencies['@pokit/tabs-ink']).toBe('latest');
    });
  });

  describe('custom template', () => {
    it('can include any combination of plugins', () => {
      const config = {
        name: 'custom-project',
        plugins: ['@pokit/reporter-clack'], // Only reporter, no prompter
      };
      const result = JSON.parse(generatePackageJson(config));

      expect(result.dependencies['@pokit/reporter-clack']).toBe('latest');
      expect(result.dependencies['@pokit/prompter-clack']).toBeUndefined();
    });
  });
});
