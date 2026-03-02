import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { main } from '../src/main';

describe('@pokit/sdk-gen', () => {
  it('generates a TS client file with typed methods for file-based commands', async () => {
    const fixtureDir = path.resolve(import.meta.dir, 'fixtures/basic');
    const outFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pok-sdk-gen-')), 'sdk.ts');

    await main([
      'generate',
      '--config',
      fixtureDir,
      '--out',
      outFile,
      '--include-pm',
      'false',
    ]);

    const text = fs.readFileSync(outFile, 'utf8');
    expect(text).toContain('export function createClient');
    expect(text).toContain('export type Client');
    expect(text).toContain('import { command as cmd_0 }');
    expect(text).toContain('CommandContextInput<typeof cmd_0>');
    expect(text).toContain('CommandReturn<typeof cmd_0>');
  });
});

