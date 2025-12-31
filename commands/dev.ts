/**
 * Dev command - parent for development server commands
 *
 * Opens a sub menu to select which site to run
 */

import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Start dev servers',
});
