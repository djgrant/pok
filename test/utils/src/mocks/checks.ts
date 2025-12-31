import { defineCheck } from '@pokit/core';

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

/**
 * A failing check with remediation steps to help users fix the issue
 */
export const alwaysFailWithRemediation = defineCheck({
  label: 'Fails with remediation',
  check: async () => {
    throw new Error('Docker is not running');
  },
  errorMessage: 'Docker daemon is not running',
  remediation: ['Start Docker Desktop, or', "Run 'sudo systemctl start docker' (Linux)"],
  documentationUrl: 'https://docs.docker.com/get-started/',
});

/**
 * A failing check with a single remediation step (string instead of array)
 */
export const alwaysFailWithSingleRemediation = defineCheck({
  label: 'Fails with single remediation',
  check: async () => {
    throw new Error('Node.js version too old');
  },
  errorMessage: 'Node.js 20+ required',
  remediation: 'Install Node.js 20+ from https://nodejs.org/',
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
