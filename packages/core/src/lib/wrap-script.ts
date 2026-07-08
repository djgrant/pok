/**
 * wrapScript — a first-class "wrap a subprocess" command primitive.
 *
 * Most script-wrapper commands are the same shape: parse some flags/args, then
 * shell out to `python3 <script> <args>`. `wrapScript` collapses that boilerplate
 * to a single declaration and centralizes the positional/passthrough story.
 *
 * The `argv` builder returns the base command as an argument array (never a
 * shell string), so it is spawned directly without a shell — dynamic values are
 * safe from word-splitting and injection. Any extra positionals and everything
 * after a `--` passthrough separator are appended automatically, so the wrapped
 * script's own flags are reachable without modeling them in the context schema.
 *
 * @example
 * ```ts
 * export const command = wrapScript({
 *   label: 'Show emails',
 *   context: {
 *     query: { from: 'arg', schema: z.string(), description: 'Search query' },
 *   },
 *   argv: ({ query }) => ['python3', script('read_emails.py'), 'show', query],
 * });
 *
 * // emails show 3            -> python3 read_emails.py show 3
 * // emails show 3 -- --json  -> python3 read_emails.py show 3 --json
 * ```
 */

import { defineCommand } from './command';
import type { ContextDef, InferContext, CommandConfig } from './command';

export type WrapScriptConfig<C extends ContextDef> = {
  /** Human-readable label for menus and help. */
  label: string;
  /** Extended description for help text. */
  description?: string;
  /** Alternative names for this command. */
  aliases?: string[];
  /** Example invocations shown in help text. */
  examples?: string[];
  /** Context definitions — positional args (`from: 'arg' | 'args'`) or flags. */
  context?: C;
  /** Default timeout in milliseconds for the spawned process. */
  timeout?: number;
  /**
   * Build the base command as an argument array.
   *
   * Receives the resolved context. Return e.g.
   * `['python3', '/abs/script.py', 'show', ctx.query]`.
   */
  argv: (context: InferContext<C>) => string[];
  /**
   * Append extra positionals and post-`--` passthrough args to the command.
   * @default true
   */
  passthrough?: boolean;
};

/**
 * Define a command that wraps a subprocess.
 *
 * Enables `ignoreUnknownFlags` so unrecognized flags flow through to the wrapped
 * script instead of erroring, and appends `extraArgs` (extra positionals +
 * everything after `--`) to the built argv unless `passthrough` is disabled.
 */
export function wrapScript<C extends ContextDef>(
  config: WrapScriptConfig<C>
): CommandConfig<C> {
  const passthrough = config.passthrough ?? true;

  return defineCommand<C>({
    label: config.label,
    description: config.description,
    aliases: config.aliases,
    examples: config.examples,
    context: config.context,
    timeout: config.timeout,
    ignoreUnknownFlags: passthrough,
    run: async (r, ctx) => {
      const base = config.argv(ctx.context);
      const argv = passthrough ? [...base, ...ctx.extraArgs] : base;
      // Array form: spawned directly, no shell, so values are not re-split.
      await r.exec(argv);
    },
  }) as CommandConfig<C>;
}
