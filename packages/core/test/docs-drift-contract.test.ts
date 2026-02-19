import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pokRoot = resolve(import.meta.dir, '../../..');
const piqGuidePath = resolve(pokRoot, 'docs/guides/dynamic-menus-piq.md');

function readUtf8(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('docs drift: pok piq integration guide', () => {
  it('uses current scan/filter/select + namespace terms', () => {
    const guide = readUtf8(piqGuidePath);

    expect(guide).toContain('.scan(');
    expect(guide).toContain('.filter(');
    expect(guide).toContain('.select(');
    expect(guide).toContain('params.');
    expect(guide).toContain('frontmatter.');
  });

  it('does not use deprecated piq query terms', () => {
    const guide = readUtf8(piqGuidePath);

    const deprecatedTerms = ['.search(', 'r.search', 'r.meta', 'select({ meta', 'select({ body'];
    for (const deprecated of deprecatedTerms) {
      expect(guide.includes(deprecated)).toBe(false);
    }
  });
});

describe('cross-repo smoke contract: pok guide aligns with piq API docs', () => {
  const piqApiPath = resolve(pokRoot, '../piq/docs/reference/api.md');

  (existsSync(piqApiPath) ? it : it.skip)(
    'documents the same scan/filter/select + namespace contract as piq',
    () => {
      const guide = readUtf8(piqGuidePath);
      const piqApi = readUtf8(piqApiPath);

      for (const token of ['scan(', 'filter(', 'select(', 'params.', 'frontmatter.']) {
        expect(piqApi).toContain(token);
        expect(guide).toContain(token);
      }
    }
  );
});
