/**
 * Shared terminal screen state.
 *
 * The terminal UI is a single screen owner. Loading indicators (spinners) are
 * created here rather than ad-hoc inside individual prompts, so the prompter
 * does not spawn its own competing clack spinners for dynamic selects. The
 * reporter adapter and the prompter both belong to the same terminal UI and
 * share this screen.
 */

import * as p from '@clack/prompts';
import type { OutputConfig } from '@pokit/core';

export interface Screen {
  /**
   * Run `fn` while showing a loading indicator. The indicator is the single
   * screen-owned spinner; the prompter never creates its own.
   */
  withLoading<T>(message: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T>;
}

function canUseInteractiveUI(outputConfig: OutputConfig): boolean {
  return outputConfig.unicode && outputConfig.interactive;
}

/**
 * Create the shared screen for a terminal UI instance.
 */
export function createScreen(outputConfig: OutputConfig): Screen {
  const interactive = canUseInteractiveUI(outputConfig);

  return {
    async withLoading<T>(message: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
      const controller = new AbortController();

      if (!interactive) {
        return fn(controller.signal);
      }

      const spinner = p.spinner();
      spinner.start(message);
      try {
        const result = await fn(controller.signal);
        spinner.stop(message);
        return result;
      } catch (error) {
        controller.abort();
        spinner.stop('Failed to load');
        throw error;
      }
    },
  };
}
