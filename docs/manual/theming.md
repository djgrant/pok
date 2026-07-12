# Theming

The default terminal UI (@pokit/terminal) is themeable from `pok.config.ts`. A theme is data: a preset name, glyph overrides, and colour names. It applies to both the reporter output and the interactive prompts, so the whole UI follows one visual language.

```typescript
import { defineConfig } from '@pokit/core';

export default defineConfig({
  commandsDir: './commands',
  theme: {
    preset: 'minimal',
    glyphs: { activityDone: '✔' },
    colors: { success: 'cyan', frame: 'gray' },
  },
});
```

## Presets

The preset selects the overall structure. Two are built in.

`rail` (the default) draws boxed output with a left rail:

```
┌  Reconcile post-publish bookkeeping
│
◇  Repin root deps
│
●  Root deps already pinned to latest published.
│
└  ✔ Done
```

`minimal` is flat and indentation-based, with no rails:

```
▶ Reconcile post-publish bookkeeping
  ✓ Repin root deps
  · Root deps already pinned to latest published.
✓ done
```

Prompts follow the preset: `rail` prompts draw the rail with `◆`/`●` markers; `minimal` prompts use a `?` heading and a `❯` cursor.

## Glyphs

Glyph overrides apply on top of the preset. Available slots: `info`, `warn`, `error`, `success`, `step`, `activityDone`, `activityFailed`.

```typescript
theme: {
  glyphs: { activityDone: '✔', step: '»' },
}
```

## Colours

Colour overrides take named colours: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`, `dim`, or `none` for unstyled. Slots: the five log levels plus `frame` (rails and box corners) and `spinner`.

```typescript
theme: {
  colors: { success: 'cyan', spinner: 'blue' },
}
```

`--no-color` and `NO_COLOR` still strip all colour; the theme only decides what colour is used when colour is on. Likewise `--no-unicode` swaps to each preset's ASCII glyph set, and glyph overrides apply on top of that too.

## Spinner

`spinnerFrames` replaces the live spinner animation:

```typescript
theme: {
  spinnerFrames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
}
```

## Previewing a theme

Render every reporter scenario with a preset in a real terminal:

```bash
THEME=minimal bun packages/terminal/scripts/gallery.ts
```

## Scope

The theme configures the *default* terminal UI. A config that supplies its own `reporter` or `prompter` instances owns its rendering, and the theme spec does not apply to it — though a custom UI package is free to read the same `ThemeSpec` from config and honour it.

Programmatic use follows the same shape:

```typescript
import { createTerminalUI } from '@pokit/terminal';

const ui = createTerminalUI({ theme: { preset: 'minimal' } });
```
