import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { spawn } from 'bun';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const POKS_BIN = path.resolve(import.meta.dir, '../bin/poks.ts');

describe('poks', () => {
  let tempDir: string;
  let historyDir: string;
  let capturePath: string;
  const appName = 'poks-test';
  const replayedArgs = ['hello world', '$(touch should-not-exist)', "it's quoted"];

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poks-cmd-test-'));
    historyDir = path.join(tempDir, 'history');
    capturePath = path.join(tempDir, 'captured.json');

    fs.writeFileSync(
      path.join(tempDir, 'pok.config.ts'),
      `export default { appName: '${appName}' };\n`
    );

    const pokitModules = path.join(tempDir, 'node_modules', '@pokit');
    fs.mkdirSync(pokitModules, { recursive: true });
    fs.symlinkSync(path.resolve(import.meta.dir, '../../core'), path.join(pokitModules, 'core'));

    const terminalDir = path.join(pokitModules, 'terminal');
    fs.mkdirSync(terminalDir);
    fs.writeFileSync(
      path.join(terminalDir, 'package.json'),
      JSON.stringify({ name: '@pokit/terminal', type: 'module', exports: './index.js' })
    );
    fs.writeFileSync(
      path.join(terminalDir, 'index.js'),
      `export function createTerminalUI() {
        return { prompter: { autocomplete: async ({ options }) => options[0].value } };
      }\n`
    );

    const historyPath = path.join(historyDir, 'pok', appName, 'history.json');
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(
      historyPath,
      JSON.stringify({
        entries: [{ commandPath: ['echo'], args: replayedArgs, timestamp: new Date().toISOString() }],
      })
    );

    const fakePok = path.join(tempDir, 'pok');
    fs.writeFileSync(
      fakePok,
      `#!/usr/bin/env bun
import * as fs from 'fs';
fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify(process.argv.slice(2)));
`
    );
    fs.chmodSync(fakePok, 0o755);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses @pokit/terminal and replays arguments without shell interpolation', async () => {
    const proc = spawn(['bun', POKS_BIN], {
      cwd: tempDir,
      env: {
        ...process.env,
        POK_HISTORY_DIR: historyDir,
        CAPTURE_PATH: capturePath,
        PATH: `${tempDir}${path.delimiter}${process.env.PATH ?? ''}`,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(JSON.parse(fs.readFileSync(capturePath, 'utf8'))).toEqual(['echo', ...replayedArgs]);
    expect(fs.existsSync(path.join(tempDir, 'should-not-exist'))).toBe(false);
  });
});
