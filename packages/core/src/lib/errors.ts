/**
 * Shared error classification.
 *
 * The CLI distinguishes two kinds of failure:
 *
 * - **Operational errors** are *expected* failures whose message (and any
 *   captured output) is the useful diagnostic: a subprocess exiting non-zero,
 *   a bad flag, a failed check, a timeout, a user cancellation. These are
 *   presented as a clean message and NEVER with a stack trace — a stack back
 *   into the CLI's own source frames is noise for these.
 * - **Unexpected errors** are bugs. They are printed with their full stack to
 *   aid debugging.
 *
 * Error classes opt in to "operational" by branding themselves via
 * {@link markOperational} in their constructor. Keeping the predicate here
 * means every layer (runner, router, cli, reporter) agrees on one definition
 * instead of re-deriving it with scattered `instanceof` checks.
 *
 * Separately, {@link markPresented} lets a presentation layer (e.g. the
 * terminal reporter) record that it has already surfaced an error to the user,
 * so the top-level handler can avoid printing it a second time.
 */

/** Brand marking an error as an expected/operational failure. */
export const OPERATIONAL_ERROR: unique symbol = Symbol.for('pokit.operationalError');

/** Brand marking an error as already surfaced to the user by a presenter. */
export const PRESENTED_ERROR: unique symbol = Symbol.for('pokit.presentedError');

/** An error that has opted in to operational (expected) classification. */
export interface OperationalError extends Error {
  readonly [OPERATIONAL_ERROR]: true;
}

function brand(error: Error, key: symbol): void {
  Object.defineProperty(error, key, {
    value: true,
    enumerable: false,
    configurable: true,
    writable: false,
  });
}

/**
 * Mark an error as operational (expected). Call from the constructor of any
 * error class whose failures should be shown as a clean message without a
 * stack trace.
 */
export function markOperational(error: Error): void {
  brand(error, OPERATIONAL_ERROR);
}

/** True when the error is an expected/operational failure. */
export function isOperationalError(error: unknown): error is OperationalError {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as Record<PropertyKey, unknown>)[OPERATIONAL_ERROR] === true
  );
}

/**
 * Mark an error as already presented to the user. A presenter (such as the
 * terminal reporter's failure box) calls this after surfacing the error so the
 * top-level handler doesn't print it again.
 */
export function markPresented(error: unknown): void {
  if (error && typeof error === 'object') {
    brand(error as Error, PRESENTED_ERROR);
  }
}

/** True when the error has already been surfaced to the user. */
export function wasPresented(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as Record<PropertyKey, unknown>)[PRESENTED_ERROR] === true
  );
}
