/**
 * Path constants for test utilities.
 */

import * as path from 'path';

/**
 * Path to test commands directory for CLI discovery.
 * These are re-exports that point to the actual case commands.
 */
export const COMMANDS_DIR = path.resolve(import.meta.dir, '../../../../test/commands');

/**
 * Path to test cases directory.
 * Each case contains command.ts, events.ts, and output.ts.
 */
export const CASES_DIR = path.resolve(import.meta.dir, '../../../../test/cases');

/**
 * Project root for CLI execution context.
 */
export const PROJECT_ROOT = path.resolve(import.meta.dir, '../../../..');
