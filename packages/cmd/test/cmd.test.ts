/**
 * Integration tests for @pokjs/cmd
 *
 * Tests the global CLI launcher behavior.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'bun';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CMD_BIN = path.resolve(import.meta.dir, '../bin/pok.ts');

describe('@pokjs/cmd', () => {
  describe('when used in a project with commands', () => {
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

      // Create commands directory with a simple command
      fs.mkdirSync(path.join(tempDir, 'commands'));
      fs.writeFileSync(
        path.join(tempDir, 'commands', 'hello.ts'),
        `
import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    console.log('Hello from test!');
  },
});
`
      );

      // Link to the workspace packages by creating node_modules symlinks
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokjs');
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

  describe('when no commands directory exists', () => {
    let tempDir: string;

    beforeAll(() => {
      // Create a temp directory without commands/
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-cmd-test-'));
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );

      // Link core so it can be imported
      const nodeModulesDir = path.join(tempDir, 'node_modules', '@pokjs');
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      const packagesDir = path.resolve(import.meta.dir, '../..');
      fs.symlinkSync(path.join(packagesDir, 'core'), path.join(nodeModulesDir, 'core'));
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
      expect(stderr).toContain('commands');
    });
  });
});
