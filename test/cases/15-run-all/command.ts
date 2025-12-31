import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Run all children example',
  enableRunAllChildren: 'sequential',
});
