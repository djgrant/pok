# @pokit/terminal

`@pokit/terminal` is the default terminal UI for pok CLIs, built on [clack](https://github.com/bombshell-dev/clack). It bundles the three UI surfaces — **reporter** (event rendering), **prompter** (interactive input), and **navigator** (menu presentation policy) — behind a single factory, so an app wires them in with one call.

## Installation

```bash
bun add @pokit/terminal
```

`@pokit/core` is a peer dependency.

## Zero-config

You usually do not import `@pokit/terminal` directly. When your `pok.config.ts` omits `reporter`, `prompter`, or `navigator`, the `pok` launcher resolves `@pokit/terminal` from your project and wires in its defaults automatically:

```typescript
import { defineConfig } from '@pokit/core';

export default defineConfig({});
```

The launcher also uses these defaults in **fallback mode** — when a repo has a `package.json` but no `pok.config.ts`.

## createTerminalUI

```typescript
import { createTerminalUI } from '@pokit/terminal';

const { reporter, prompter, navigator } = createTerminalUI();
```

### Signature

```typescript
function createTerminalUI(options?: TerminalUIOptions): TerminalUI;

type TerminalUIOptions = {
  /** When true, logs are displayed immediately instead of being buffered during spinners. */
  verbose?: boolean;
  /** Output configuration (color, unicode, interactive). Detected from args/env when omitted. */
  output?: OutputConfig;
};

type TerminalUI = {
  reporter: ReporterAdapter;
  prompter: Prompter;
  navigator: Navigator;
};
```

All three surfaces share a single screen, so loading indicators and rendering are owned in one place.

## Passing options explicitly

Only construct the UI yourself when you need to pass options. Spread the result into your config:

```typescript
import { defineConfig } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

export default defineConfig({
  ...createTerminalUI({ verbose: true }),
});
```

## Surfaces

| Surface | Type | Role |
| --- | --- | --- |
| `reporter` | `ReporterAdapter` | Subscribes to the event bus and renders spinners, groups, and logs. |
| `prompter` | `Prompter` | Interactive `select`, `multiselect`, `confirm`, `text`, and `autocomplete`. |
| `navigator` | `Navigator` | Menu presentation policy: breadcrumbs, choose/back/exit, up-navigation on cancel. |

## Related

- [Prompter API](../api/prompter.md)
- [Navigator API](../api/navigator.md)
- [Events API](../api/events.md)
