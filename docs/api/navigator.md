# Navigator

The `Navigator` owns interactive **menu presentation policy** — the parts of command-tree navigation that are about how choices are shown to the user, as opposed to how the tree itself is structured (which the router owns).

Responsibilities:

- Choosing a child from a command node (the autocomplete-vs-select fallback).
- Rendering the breadcrumb trail for the current path.
- Mapping cancellation (Esc / Ctrl-C) to up-navigation (`back`) rather than aborting the whole CLI.

The router calls `choose()` once per menu level and interprets the result: a selection descends or executes, `back` pops up a level, and `exit` unwinds the CLI.

## Contract

```typescript
interface Navigator {
  choose(ctx: NavContext): Promise<NavResult>;
}
```

## Types

```typescript
type NavOption = {
  /** The value returned when this option is chosen (typically a command segment). */
  value: string;
  /** The label displayed to the user. */
  label: string;
  /** Optional hint text. */
  hint?: string;
};

type NavContext = {
  /** App name, shown as the root of the breadcrumb trail. */
  appName: string;
  /** Navigation path from the root to the node whose children are shown (excludes the app name). Empty at the top level. */
  path: string[];
  /** The prompt message to display. */
  message: string;
  /** The options to choose from. */
  options: NavOption[];
  /** Reporter scoped to the current menu group (used for the breadcrumb). */
  reporter: Reporter;
};

type NavResult =
  | { type: 'select'; value: string }
  | { type: 'back' }
  | { type: 'exit' };
```

## Back-navigation behavior

The default navigator maps a cancelled prompt (a thrown `CancelError`) to `{ type: 'back' }`, which gives up-navigation for free:

- **Esc in a submenu** goes **up** one level.
- **Esc at the root** exits the CLI. The router decides that `back` at the root level means exit, which preserves Ctrl-C-at-root as an exit.

## createMenuNavigator

`@pokit/core` ships the default navigator. `@pokit/terminal` wires it in automatically; you rarely construct it yourself.

```typescript
import { createMenuNavigator } from '@pokit/core';

const navigator = createMenuNavigator(prompter);
```

Presentation policy:

- Prefers the prompter's `autocomplete` prompt, falling back to `select`.
- Emits a breadcrumb (`appName > a > b`) before non-root menus.
- Maps a cancelled prompt to `back`.

## Custom navigator

Provide your own via `pok.config.ts`:

```typescript
import { defineConfig } from '@pokit/core';
import type { Navigator } from '@pokit/core';

const navigator: Navigator = {
  async choose(ctx) {
    // custom presentation
    return { type: 'select', value: ctx.options[0].value };
  },
};

export default defineConfig({ navigator });
```

## Related

- [Prompter API](./prompter.md)
- [@pokit/terminal](../packages/terminal.md)
- [Router API](./router.md)
