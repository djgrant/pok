/**
 * Shared terminal screen state.
 *
 * The terminal UI is a single screen owner. Loading indicators are drawn by
 * the renderer's LiveRegion rather than ad-hoc inside individual prompts, so
 * the prompter and the reporter share one spinner implementation and one
 * visual language.
 */

import type { OutputConfig, ThemeSpec } from '@pokit/core';
import { createTheme } from './reporter/renderer/theme.js';
import { LiveRegion } from './reporter/renderer/live-region.js';

export interface Screen {
  /**
   * Run `fn` while showing a loading indicator. The indicator is the single
   * screen-owned live region; the prompter never creates its own.
   */
  withLoading<T>(message: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T>;
}

/**
 * Create the shared screen for a terminal UI instance.
 */
export function createScreen(outputConfig: OutputConfig, spec?: ThemeSpec): Screen {
  const theme = createTheme(outputConfig, spec);
  const interactive = Boolean(outputConfig.interactive);

  return {
    async withLoading<T>(message: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
      const controller = new AbortController();
      const region = new LiveRegion(interactive, theme);
      region.start(message);
      try {
        const result = await fn(controller.signal);
        region.stop();
        return result;
      } catch (error) {
        controller.abort();
        region.stop();
        throw error;
      }
    },
  };
}
