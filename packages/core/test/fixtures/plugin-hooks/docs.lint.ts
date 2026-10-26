import { defineCommand } from '../../../src';
import { calls } from './_calls';

// Overrides `docs lint` inside a plugin's `docs` mount, leaving `docs build`.
export const command = defineCommand({
  label: 'Lint docs (project)',
  run: async () => {
    calls.push('user.lint');
  },
});
