/**
 * Event capture utilities for testing CLI commands.
 *
 * These utilities run CLI commands with raw adapters and capture
 * emitted events for assertions.
 */

import { run, createRawReporterAdapter, createRawPrompter, type CLIEvent } from '@openpok/core';
import { normalizeEvents } from '@openpok/test-utils';
import { COMMANDS_DIR, PROJECT_ROOT } from './paths';

/**
 * Result of capturing CLI events.
 */
export type CaptureResult = {
  /** All events emitted during execution */
  events: CLIEvent[];
  /** Error thrown during execution, if any */
  error?: Error;
};

/**
 * Options for capturing CLI events.
 */
export type CaptureOptions = {
  /** Pre-configured responses for select prompts (consumed in order) */
  selectResponses?: unknown[];
  /** Pre-configured responses for confirm prompts */
  confirmResponses?: boolean[];
  /** Pre-configured responses for text prompts */
  textResponses?: string[];
};

/**
 * Run a CLI command and capture all emitted events.
 *
 * Uses raw adapters that collect events without terminal output,
 * making it suitable for testing and assertions.
 *
 * @param args - CLI arguments (e.g., ['with-pre'] or ['parent', 'child-a'])
 * @param options - Pre-configured responses for interactive prompts
 * @returns Captured events and any error that occurred
 *
 * @example
 * ```ts
 * // Direct command execution
 * const { events } = await captureEvents(['with-pre']);
 *
 * // Interactive menu navigation
 * const { events } = await captureEvents([], {
 *   selectResponses: ['parent', 'child-a'],
 * });
 *
 * // Command with error
 * const { events, error } = await captureEvents(['failing-command']);
 * expect(error).toBeDefined();
 * ```
 */
export async function captureEvents(
  args: string[],
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const events: CLIEvent[] = [];
  const reporterAdapter = createRawReporterAdapter({
    onEvent: (event) => events.push(event),
  });
  const prompter = createRawPrompter({
    selectResponses: options.selectResponses,
    confirmResponses: options.confirmResponses,
    textResponses: options.textResponses,
  });

  let error: Error | undefined;

  try {
    await run(args, {
      commandsDir: COMMANDS_DIR,
      projectRoot: PROJECT_ROOT,
      appName: 'cli-test',
      reporterAdapter,
      prompter,
    });
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  }

  return { events, error };
}

/**
 * Capture events and normalize them in one step.
 * Convenience wrapper for common test pattern.
 */
export async function captureNormalizedEvents(
  args: string[],
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const result = await captureEvents(args, options);
  return {
    ...result,
    events: normalizeEvents(result.events),
  };
}
