import * as fs from 'fs';
import * as path from 'path';

const source = path.resolve(import.meta.dir, '../../../SKILL.md');
const target = path.resolve(import.meta.dir, '../SKILL.md');

if (process.argv[2] === 'clean') {
  fs.rmSync(target, { force: true });
} else {
  fs.copyFileSync(source, target);
}
