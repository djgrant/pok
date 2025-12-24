export { defineOpVault, parseOpRef } from './vault';
export type { OpVault, OpVaultRef, InferOpVaultKeys } from './vault';

export { defineOpResolver } from './resolver';
export type { OpResolverConfig } from './resolver';

// =============================================================================
// 1Password CLI utilities
// =============================================================================

export * as opUtils from './op';

export type { OpItem } from './op';

// =============================================================================
// 1Password CLI checks
// =============================================================================

export { opInstalled, opAuthenticated } from './checks';
