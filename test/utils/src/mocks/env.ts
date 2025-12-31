import { defineEnv } from '@pokit/core';
import { mockResolver, simpleResolver } from './resolver';

export const mockEnv = defineEnv({
  resolver: mockResolver,
  vars: ['API_KEY', 'DATABASE_URL'],
});

export const secretEnv = defineEnv({
  resolver: mockResolver,
  vars: ['SECRET_TOKEN'],
});

export const simpleEnv = defineEnv({
  resolver: simpleResolver,
  vars: ['SIMPLE_VAR'],
});
