/**
 * Test command with aliases.
 */
import { defineCommand } from '@openpok/core';

export const command = defineCommand({
  label: 'Command with aliases',
  aliases: ['wa', 'aliased'],
  run: async (r) => {
    await r.exec('echo "Hello from aliased command"');
  },
});
