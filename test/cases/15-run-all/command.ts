import { defineCommand } from '@pokjs/core';

export const command = defineCommand({
  label: 'Run all children example',
  enableRunAllChildren: 'sequential',
});
