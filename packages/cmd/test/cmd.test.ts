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

      // Link packages first so imports work in config
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
      fs.symlinkSync(
        path.join(packagesDir, 'terminal'),
        path.join(nodeModulesDir, 'terminal')
      );

      // Create pok.config.ts with instantiated adapters
      fs.writeFileSync(
        path.join(tempDir, 'pok.config.ts'),
        `
import { defineConfig } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

export default defineConfig({
  commandsDir: './commands',
  ...createTerminalUI(),
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

  describe('when no config file exists and no package.json exists', () => {
    let tempDir: string;

    beforeAll(() => {
      // Create a truly empty temp directory
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-empty-'));
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
      expect(stderr).toContain('No pok configuration or package.json found');
    });
  });

  describe('when no config file exists but package.json exists', () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-fallback-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'fallback-project',
          scripts: {
            hello: 'echo hello world',
          },
        })
      );

      // Link packages so fallback mode can load them
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
      fs.symlinkSync(
        path.join(packagesDir, 'terminal'),
        path.join(nodeModulesDir, 'terminal')
      );
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('runs in fallback mode and shows scripts', async () => {
      // Use --help to avoid interactive menu
      const proc = spawn(['bun', CMD_BIN, '--help'], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('hello');
      expect(stdout).toContain('init');
    });
  });

  describe('when config omits reporter and prompter', () => {
    let tempDir: string;

    beforeAll(() => {
      // reporter/prompter are optional now: the launcher wires in the default
      // terminal UI (@pokit/terminal) when they are omitted.
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );

      // Config with no reporter/prompter - defaults should be filled in.
      fs.writeFileSync(
        path.join(tempDir, 'pok.config.ts'),
        `
import { defineConfig } from '@pokit/core';

export default defineConfig({
  commandsDir: './commands',
});
`
      );

      fs.mkdirSync(path.join(tempDir, 'commands'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'commands', 'hello.ts'),
        `
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Say hello',
  run: async () => {
    console.log('Hello from default UI!');
  },
});
`
      );

      // Link packages (only core - @pokit/terminal resolves from the launcher).
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('runs using the default terminal UI', async () => {
      const proc = spawn(['bun', CMD_BIN, 'hello'], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Hello from default UI!');
    });
  });

  describe('when an explicit commands directory does not exist and nothing else mounts', () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );

      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
      fs.symlinkSync(
        path.join(packagesDir, 'terminal'),
        path.join(nodeModulesDir, 'terminal')
      );

      fs.writeFileSync(
        path.join(tempDir, 'pok.config.ts'),
        `
import { defineConfig } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

export default defineConfig({
  commandsDir: './non-existent-commands',
  ...createTerminalUI(),
});
`
      );
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('errors because the composed tree is empty', async () => {
      const proc = spawn(['bun', CMD_BIN, '--help'], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const output = `${stdout}\n${stderr}`;

      expect(exitCode).toBe(1);
      expect(output).toContain('No commands found');
    });
  });

  describe('when commandsDir is omitted and plugins mount commands', () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );

      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokit');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
      fs.symlinkSync(
        path.join(packagesDir, 'terminal'),
        path.join(nodeModulesDir, 'terminal')
      );

      fs.writeFileSync(
        path.join(tempDir, 'pok.config.ts'),
        `
import { defineConfig, defineCommand, fromStatic } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

export default defineConfig({
  ...createTerminalUI(),
  plugins: [
    fromStatic({
      ping: defineCommand({
        label: 'Ping',
        run: async () => {
          console.log('pong');
        },
      }),
    }),
  ],
});
`
      );
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('runs without complaining about a missing commands directory', async () => {
      const proc = spawn(['bun', CMD_BIN, '--help'], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('ping');
      expect(stderr).not.toContain('Commands directory does not exist');
      expect(stderr).not.toContain('No commands found');
    });
  });
});
