/**
 * Integration tests for pokit (global CLI launcher)
 *
 * Tests the global CLI launcher behavior with required config file.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'bun';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CMD_BIN = path.resolve(import.meta.dir, '../bin/pok.ts');

describe('pokit', () => {
  describe('when used in a project with pok.config.ts', () => {
    let tempDir: string;

    beforeAll(async () => {
      // Create a temp directory with proper structure
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));

      // Create package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          type: 'module',
        })
      );

      // Create pok.config.ts
      fs.writeFileSync(
        path.join(tempDir, 'pok.config.ts'),
        `
import { defineConfig } from '${path.resolve(import.meta.dir, '../src/config.ts')}';

export default defineConfig({
  commandsDir: './commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
});
`
      );

      // Create commands directory with a simple command
      fs.mkdirSync(path.join(tempDir, 'commands'));
      fs.writeFileSync(
        path.join(tempDir, 'commands', 'hello.ts'),
        `
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    console.log('Hello from test!');
  },
});
`
      );

      // Link to the workspace packages by creating node_modules symlinks
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
      fs.symlinkSync(
        path.join(packagesDir, 'reporter-clack'),
        path.join(nodeModulesDir, 'reporter-clack')
      );
      fs.symlinkSync(
        path.join(packagesDir, 'prompter-clack'),
        path.join(nodeModulesDir, 'prompter-clack')
      );
    });

    afterAll(() => {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('runs successfully with a simple command', async () => {
      const proc = spawn(['bun', CMD_BIN, 'hello'], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Hello from test!');
    });
  });

  describe('when no config file exists', () => {
    let tempDir: string;

    beforeAll(() => {
      // Create a temp directory without pok.config.ts
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );

      // Link core so it can be imported
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('shows error about missing config file', async () => {
      const proc = spawn(['bun', CMD_BIN], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).toBe(1);
      expect(stderr).toContain('No pok configuration found');
      expect(stderr).toContain('pok init');
    });
  });

  describe('when config has missing required fields', () => {
    let tempDir: string;

    beforeAll(() => {
      // Create a temp directory with invalid config
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );

      // Create pok.config.ts with missing required field
      fs.writeFileSync(
        path.join(tempDir, 'pok.config.ts'),
        `
export default {
  commandsDir: './commands',
  // Missing reporterAdapter and prompter
};
`
      );

      // Link core
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('shows error about missing required field', async () => {
      const proc = spawn(['bun', CMD_BIN], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).toBe(1);
      expect(stderr).toContain('reporterAdapter is required');
    });
  });

  describe('when commands directory does not exist', () => {
    let tempDir: string;

    beforeAll(() => {
      // Create a temp directory with config pointing to non-existent commands dir
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );

      // Create pok.config.ts pointing to non-existent directory
      fs.writeFileSync(
        path.join(tempDir, 'pok.config.ts'),
        `
import { defineConfig } from '${path.resolve(import.meta.dir, '../src/config.ts')}';

export default defineConfig({
  commandsDir: './non-existent-commands',
  reporterAdapter: '@pokit/reporter-clack',
  prompter: '@pokit/prompter-clack',
});
`
      );

      // Link packages
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
      fs.symlinkSync(
        path.join(packagesDir, 'reporter-clack'),
        path.join(nodeModulesDir, 'reporter-clack')
      );
      fs.symlinkSync(
        path.join(packagesDir, 'prompter-clack'),
        path.join(nodeModulesDir, 'prompter-clack')
      );
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('shows error about missing commands directory', async () => {
      const proc = spawn(['bun', CMD_BIN], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Commands directory not found');
    });
  });
});
