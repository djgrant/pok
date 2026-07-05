/**
 * Navigator
 *
 * The Navigator owns interactive *menu presentation policy* — the parts of
 * command-tree navigation that are about how choices are shown to the user,
 * as opposed to how the tree itself is structured (which the router owns).
 *
 * Responsibilities:
 * - Choosing a child from a command node (the autocomplete-vs-select fallback)
 * - Rendering the breadcrumb trail for the current path
 * - Mapping cancellation (Esc / Ctrl-C) to up-navigation ('back') rather than
 *   aborting the whole CLI
 *
 * The router calls `choose()` once per menu level and interprets the result:
 * a selection descends/executes, 'back' pops up a level, and 'exit' unwinds.
 */

import type { Prompter } from './types';
import type { Reporter } from '../events';
import { CancelError } from '../lib/cancel';

/**
 * A single selectable option in a navigation menu.
 */
export type NavOption = {
  /** The value returned when this option is chosen (typically a command segment) */
  value: string;
  /** The label displayed to the user */
  label: string;
  /** Optional hint text */
  hint?: string;
};

/**
 * Context passed to `Navigator.choose` for a single menu level.
 */
export type NavContext = {
  /** App name, shown as the root of the breadcrumb trail */
  appName: string;
  /**
   * Navigation path from the root to the node whose children are being shown
   * (excluding the app name). Empty at the top level.
   */
  path: string[];
  /** The prompt message to display */
  message: string;
  /** The options to choose from */
  options: NavOption[];
  /** Reporter scoped to the current menu group (used for the breadcrumb) */
  reporter: Reporter;
};

/**
 * Result of a single navigation choice.
 * - `select`: the user picked an option (its `value` is returned)
 * - `back`: the user cancelled at this level; the caller should navigate up
 * - `exit`: the CLI should unwind entirely
 */
export type NavResult =
  | { type: 'select'; value: string }
  | { type: 'back' }
  | { type: 'exit' };

/**
 * Navigator contract — owns menu presentation policy.
 */
export interface Navigator {
  choose(ctx: NavContext): Promise<NavResult>;
}

/**
 * Format a breadcrumb trail for display.
 * Shows the app name followed by the navigation path, joined by ' > '.
 * Returns an empty string at the root level.
 */
export function formatBreadcrumb(appName: string, path: string[]): string {
  if (path.length === 0) return '';
  return [appName, ...path].join(' > ');
}

/**
 * Create the default menu navigator.
 *
 * Presentation policy:
 * - Prefers the prompter's `autocomplete` prompt, falling back to `select`.
 * - Emits a breadcrumb before non-root menus.
 * - Maps a cancelled prompt (CancelError) to `back`, giving up-navigation for
 *   free. The router decides that `back` at the root level means exit, which
 *   preserves Ctrl-C-at-root as an exit.
 */
export function createMenuNavigator(prompter: Prompter): Navigator {
  return {
    async choose(ctx: NavContext): Promise<NavResult> {
      const breadcrumb = formatBreadcrumb(ctx.appName, ctx.path);
      if (breadcrumb) {
        ctx.reporter.info(breadcrumb);
      }

      const choose = prompter.autocomplete
        ? prompter.autocomplete.bind(prompter)
        : prompter.select.bind(prompter);

      try {
        const selected = await choose({
          message: ctx.message,
          options: ctx.options.map((o) => ({
            value: o.value,
            label: o.label,
            hint: o.hint,
          })),
        });
        return { type: 'select', value: String(selected) };
      } catch (error) {
        if (error instanceof CancelError) {
          return { type: 'back' };
        }
        throw error;
      }
    },
  };
}
