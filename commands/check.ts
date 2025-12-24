/**
 * Check command - parent for all validation commands
 *
 * Allows running all checks at once via `pok check all`
 */

import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Run checks',
  enableRunAllChildren: 'parallel',
});
