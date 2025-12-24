import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Run all children example',
  enableRunAllChildren: 'sequential',
});
