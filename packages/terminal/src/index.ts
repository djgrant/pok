/**
 * @pokit/terminal
 *
 * The default terminal UI for pok CLI applications. Bundles the
 * three UI surfaces — reporter (event rendering), prompter (interactive input),
 * and navigator (menu presentation policy) — behind a single factory so an app
 * wires them in with one call.
 */

import { detectOutputConfig, createMenuNavigator } from '@pokit/core';
import type {
  OutputConfig,
  ReporterAdapter,
  Prompter,
  Navigator,
} from '@pokit/core';
import { createReporterAdapter } from './reporter/adapter.js';
import { createPrompter } from './prompter/prompter.js';
import { createScreen } from './screen.js';

export type { OutputConfig, ReporterAdapter, Prompter, Navigator } from '@pokit/core';

/**
 * Options for creating the terminal UI.
 */
export type TerminalUIOptions = {
  /** When true, logs are displayed immediately instead of being buffered during spinners */
  verbose?: boolean;
  /** Output configuration (color, unicode, interactive). Detected from args/env when omitted. */
  output?: OutputConfig;
};

/**
 * The bundled terminal UI surfaces.
 */
export type TerminalUI = {
  reporter: ReporterAdapter;
  prompter: Prompter;
  navigator: Navigator;
};

/**
 * Create the default terminal UI.
 *
 * Returns the reporter adapter, prompter, and navigator, all sharing a single
 * screen so loading indicators and rendering are owned in one place.
 */
export function createTerminalUI(options?: TerminalUIOptions): TerminalUI {
  const outputConfig: OutputConfig = options?.output ?? detectOutputConfig(process.argv.slice(2));
  if (outputConfig.interactive === undefined) {
    outputConfig.interactive = true;
  }
  if (options?.verbose !== undefined) {
    outputConfig.verbose = options.verbose;
  }

  const screen = createScreen(outputConfig);
  const reporter = createReporterAdapter({ output: outputConfig });
  const prompter = createPrompter(screen);
  const navigator = createMenuNavigator(prompter);

  return { reporter, prompter, navigator };
}
