export { defineOpVault, parseOpRef } from './vault';
export type { OpVault, OpVaultRef, InferOpVaultKeys } from './vault';

export { defineOpResolver } from './resolver';
export type { OpResolverConfig } from './resolver';

// =============================================================================
// 1Password CLI utilities
// =============================================================================

export * as opUtils from './op';

export type { OpItem } from './op';

/**
 * Type exports for individual utility functions.
 * These enable consumers to reference specific function signatures
 * without accessing them through the opUtils namespace.
 */
export type IsInstalledFn = typeof import('./op').isInstalled;
export type IsAuthenticatedFn = typeof import('./op').isAuthenticated;
export type GetFieldFn = typeof import('./op').getField;

// =============================================================================
// 1Password CLI checks
// =============================================================================

export { opInstalled, opAuthenticated } from './checks';
