import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { generateSdk } from '../src';

describe('@pokit/sdk-gen', () => {
  it('generates a TS client file with typed methods for file-based commands', async () => {
    const fixtureDir = path.resolve(import.meta.dir, 'fixtures/basic');
    const outFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pok-sdk-gen-')), 'sdk.ts');

    const result = await generateSdk({
      config: fixtureDir,
      out: outFile,
      includePm: false,
    });

    const text = fs.readFileSync(outFile, 'utf8');
    expect(result.outPath).toBe(outFile);
    expect(text).toContain('export function createClient');
    expect(text).toContain('export type Client');
    expect(text).toContain('import { command as cmd_0 }');
    expect(text).toContain('CommandContextInput<typeof cmd_0>');
    expect(text).toContain('CommandReturn<typeof cmd_0>');
  });
});
