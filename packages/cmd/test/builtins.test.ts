import { describe, expect, it } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { readSkill } from '../src/builtins';

describe('launcher built-ins', () => {
  it('reads the consumer skill from the repository', async () => {
    const expected = await fs.readFile(path.resolve(import.meta.dir, '../../../SKILL.md'), 'utf8');

    expect(await readSkill()).toBe(expected);
  });
});
