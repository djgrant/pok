/**
 * @openpok/core Test Utilities
 *
 * Exports test helpers and fixtures for testing CLI patterns.
 * Use these when writing tests for CLI commands and tasks.
 *
 * ## Test Helpers
 *
 * ```ts
 * import { captureEvents, normalizeEvents } from '../test/core';
 *
 * const { events, error } = await captureEvents(['my-command']);
 * const normalized = normalizeEvents(events);
 * ```
 *
 * ## Fixtures
 *
 * ```ts
 * import * as fixtures from '../test/core/fixtures';
 *
 * expect(normalizeEvents(events)).toEqual(fixtures.commandWithPre.events);
 * ```
 */

// Test utilities
export {
  // Event capture
  captureEvents,
  captureNormalizedEvents,
  type CaptureResult,
  type CaptureOptions,
  // Path constants
  COMMANDS_DIR,
  CASES_DIR,
  SHARED_DIR,
  PROJECT_ROOT,
  // Event normalization and filtering
  normalizeEvents,
  filterEvents,
  eventTypes,
} from './utils';

// Re-export fixtures for convenience
export * as fixtures from './fixtures';
