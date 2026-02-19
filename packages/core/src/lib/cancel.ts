/**
 * Cancellation error
 *
 * Used for user-initiated cancellation (e.g. Ctrl+C / Esc) where callers should
 * be able to catch and decide how to handle termination.
 *
 * Exit code follows common shell convention for SIGINT cancellation.
 */

export const CANCEL_EXIT_CODE = 130;

export class CancelError extends Error {
  readonly exitCode: number;

  constructor(message: string = 'Cancelled', exitCode: number = CANCEL_EXIT_CODE) {
    super(message);
    this.name = 'CancelError';
    this.exitCode = exitCode;
  }
}
