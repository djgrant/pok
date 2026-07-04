/**
 * Shared runtime helpers used by both the Node.js and Bun implementations.
 */

import type { SpawnOptions } from './types';

/**
 * Normalize stdio option to the array format expected by the runtimes.
 */
export function normalizeStdio(
  stdio?: SpawnOptions['stdio']
): ['inherit', 'inherit', 'inherit'] | ['inherit', 'pipe', 'pipe'] {
  if (!stdio) {
    return ['inherit', 'inherit', 'inherit'];
  }
  if (stdio === 'inherit') {
    return ['inherit', 'inherit', 'inherit'];
  }
  if (stdio === 'pipe') {
    return ['inherit', 'pipe', 'pipe'];
  }
  return stdio;
}
