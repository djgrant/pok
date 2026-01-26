import { defineCommand } from './packages/core/src/lib/command';
import { z } from 'zod';

export const command = defineCommand({
  label: 'Deploy Production',
  context: {
    env: 'prod',
  }
});
