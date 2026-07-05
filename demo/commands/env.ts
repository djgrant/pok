import { defineCommand } from '@pokit/core';

// Parent menu command (no run): selecting it opens a submenu of its children
// (env.status, env.reset). Use it to exercise back-navigation in the Navigator.
export const command = defineCommand({
  label: 'Environments',
  description: 'Nested submenu (pick a child, then go back)',
});
