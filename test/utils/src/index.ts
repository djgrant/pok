/**
 * @pokit/test-utils
 *
 * Test utilities for pokjs packages.
 */

export { normalizeEvents, stripRootLifecycleEvents, filterEvents, eventTypes } from './normalize';

export { createVirtualTerminal, type VirtualTerminal } from './virtual-terminal';

// Shared mocks
export * as mocks from './mocks';

// Shared tasks
export * as tasks from './tasks';
