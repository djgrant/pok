# Design: owning the terminal renderer

Status: draft for review
Related: `packages/terminal/src/reporter/adapter.ts`, `docs/manual/events.md`, `docs/manual/output.md`

## Problem

The reporter's event contract is sound: commands emit semantic events (`group:start`, `activity:success`, `log`) over a bus, and adapters render them per medium. The terminal adapter, however, splits every event handler into two code paths. In interactive mode clack draws the left rail; in plain mode the adapter hand-draws the same rail with `symbols.groupLine`. Two implementations of one visual language drift, and both recent rendering bugs came from that drift.

Three concrete failures motivate this design:

1. **Doubled rail.** A `│` prefix written for the plain path leaked into the clack path, rendering `●  │  message`.
2. **Detached blocks.** Output emitted outside a group has no owner, so it floats below the closing `└` with an orphaned rail fragment. See `test/reporter/__gallery__/log-after-group.interactive.txt`.
3. **Spinner workarounds.** clack's spinner cannot coexist with other output, so the adapter carries per-activity log buffers, a 100-log cap, a stop/log/restart dance for errors, and a single shared spinner for parallel groups. That machinery is most of the adapter's state.

## Proposal

Replace clack's rendering with a small renderer we own. clack stays for prompts (`packages/terminal/src/prompter` is untouched). The event contract, `symbols.ts`, and all command code are untouched.

The renderer has three layers:

```
events ─▶ layout policy ─▶ frame ─▶ live region ─▶ stdout
              │                │
            theme ─────────────┘
```

### Theme

A pure lookup: symbols and colour functions per mode. `unicode`, `ascii`, and `no-color` become theme swaps rather than code branches. Extends the existing `SymbolSet` with rail glyphs (`┌ │ └` / `[ | ]`) and per-level colours.

### Frame

The one component allowed to draw the rail. It holds a single piece of state – whether a box is open – and exposes:

- `open(label)` / `close(status)` – draw `┌ label` and `└ ✔ Done`
- `line(symbol, text)` – draw a line inside the box, rail included, wrapping continuation lines under the rail
- `block(symbol, text)` – draw a standalone block *outside* any box, separated by a blank line, with no rail fragment

`block` gives out-of-group output defined semantics: it is a deliberate visual form, not an accident of clack's gutter. Multi-line content (remediation steps, error output, markdown) goes through `line`/`block` too, so continuation indentation is computed in one place instead of hand-written `writeLine('│ ...')` calls.

### Live region

Owns the last N rows of the screen for in-flight activities. To print a static line it erases the live rows, writes the line through the frame, and redraws. This is the standard approach in listr2 and ink, and it removes the *need* for log buffering: logs can interleave with running spinners safely.

In non-interactive mode the live region is a no-op – activity lines print on completion only, which is the current plain-mode behaviour. The frame code above it is identical in both modes, which is the point: one rail implementation.

### Layout policy

The event-to-frame mapping, holding the taste decisions:

| Event | Rendering |
|---|---|
| `group:start` / `group:end` | `frame.open` / `frame.close` |
| `activity:*` (sequence) | live row while running; `line(◇, label)` on success, `line(■, error)` on failure |
| `activity:*` (parallel) | one live row summarising progress; per-activity `line` on completion, in completion order |
| `log` inside an activity | flushed after the activity completes, as today – it reads well – but as a *policy* choice, one line of code, not buffering machinery |
| `log` outside any group | `block` |
| remediation / docs link | continuation lines under the failure `line`; for parallel groups, a `block` after `close` |
| `markdown` | `block`, rendered via marked-terminal as today |

Open question for review: whether parallel completions should print in completion order (proposed – it is honest about concurrency) or successes-first (current behaviour).

## Symbol semantics

While we are here: `step`, `success`, and completed activities all render `◇` today, so a step heading is indistinguishable from a finished task. Proposed: keep `◇` for completed activities, give `success` logs `✔`, and give `step` a distinct glyph (`▸`). Cheap to change later; the gallery makes the comparison reviewable.

## Testing and review workflow

The harness lands before the renderer (already in place):

- `test/reporter/scenarios.ts` – canonical event sequences, one per visual situation. Rendering bugs get a scenario before they get a fix.
- `test/reporter/gallery.test.ts` – renders every scenario in every mode through xterm-headless and snapshots to `__gallery__/*.txt`. `UPDATE_GALLERY=1 bun test gallery` regenerates; the diff is the review artefact.
- `scripts/gallery.ts` – replays scenarios in a real terminal with delays, for taste review of spinners and colour, which snapshots cannot capture.

## Migration

1. ~~Harness~~ (done – snapshots captured the pre-renderer behaviour, warts included).
2. ~~Build `renderer/` (theme, frame, live region)~~ (done).
3. ~~Rewrite `adapter.ts` as the layout policy over the renderer~~ (done – the gallery diff in the same commit shows every visual change).
4. ~~Delete the plain/interactive branches, the log-buffer machinery, the legacy fixtures, and `symbols.ts`~~ (done).

Remaining: taste review of the gallery diff and the live script (`bun packages/terminal/scripts/gallery.ts`), and a decision on the two open questions above.
