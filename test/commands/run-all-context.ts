import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Run all context children',
  enableRunAllChildren: 'sequential',
});
