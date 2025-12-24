/**
 * Test utilities for @openpok/core.
 *
 * @example
 * ```ts
 * import { captureEvents, normalizeEvents, eventTypes } from '../utils';
 *
 * const { events, error } = await captureEvents(['my-command']);
 * const normalized = normalizeEvents(events);
 * const types = eventTypes(events);
 * ```
 */

// Event capture (test-specific, uses hardcoded example paths)
export {
  captureEvents,
  captureNormalizedEvents,
  type CaptureResult,
  type CaptureOptions,
} from './capture';

// Path constants
export {
  COMMANDS_DIR,
  CASES_DIR,
  SHARED_DIR,
  PROJECT_ROOT,
  EXAMPLES_DIR, // deprecated
} from './paths';

// Re-export from test-utils package
export { normalizeEvents, filterEvents, eventTypes } from '@openpok/test-utils';
