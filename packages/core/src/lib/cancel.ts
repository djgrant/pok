/**
 * Cancellation error
 *
 * Used for user-initiated cancellation (e.g. Ctrl+C / Esc) where callers should
 * be able to catch and decide how to handle termination.
 *
 * Exit code follows common shell convention for SIGINT cancellation.
 */

import { markOperational, markPresented } from './errors';

export const CANCEL_EXIT_CODE = 130;

export class CancelError extends Error {
  readonly exitCode: number;

  constructor(message: string = 'Cancelled', exitCode: number = CANCEL_EXIT_CODE) {
    super(message);
    this.name = 'CancelError';
    this.exitCode = exitCode;
    markOperational(this);
    // User-initiated cancellation exits silently (no "Error: Cancelled" line);
    // only the exit code matters at the top level.
    markPresented(this);
  }
}
