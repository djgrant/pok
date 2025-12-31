import { defineCheck } from '@pokit/core';
import { isInstalled, isAuthenticated, getAuthErrorMessage } from './op';

export const opInstalled = defineCheck({
  label: '1Password CLI installed',
  check: async () => {
    const installed = await isInstalled();
    if (!installed) {
      throw new Error(
        '1Password CLI is not installed. ' +
          'Install from: https://developer.1password.com/docs/cli/get-started/'
      );
    }
  },
});

export const opAuthenticated = defineCheck({
  label: '1Password authenticated',
  check: async () => {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      throw new Error(getAuthErrorMessage());
    }
  },
});
