import { defineCheck } from '@openpok/core';

export const alwaysPass = defineCheck({
  label: 'Always passes',
  check: async () => {},
});

export const secondCheck = defineCheck({
  label: 'Second check',
  check: async () => {},
});

export const alwaysFail = defineCheck({
  label: 'Always fails',
  check: async () => {
    throw new Error('This check always fails');
  },
});

export const slowCheck = defineCheck({
  label: 'Slow check',
  check: async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
});

export const conditionalCheck = (shouldPass: boolean) =>
  defineCheck({
    label: shouldPass ? 'Conditional (pass)' : 'Conditional (fail)',
    check: async () => {
      if (!shouldPass) {
        throw new Error('Conditional check failed');
      }
    },
  });
