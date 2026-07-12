/**
 * Autocomplete prompt: type-ahead filtering over a windowed radio list.
 *
 * Filtering matches the label, hint, and stringified value. The cursor wraps
 * at both ends of the filtered list (the behaviour we previously carried as a
 * patched copy of clack's autocomplete).
 */

import type { Key } from 'node:readline';
import pc from 'picocolors';
import { PromptBase, type PromptIO } from './prompt';
import {
  BAR,
  BAR_END,
  RADIO_ACTIVE,
  RADIO_INACTIVE,
  heading,
  submittedFrame,
  cancelledFrame,
  windowItems,
  defaultMaxVisible,
  dimHint,
} from './render';
import type { SelectItem } from './select';

export type AutocompletePromptOptions<T> = PromptIO & {
  message: string;
  options: SelectItem<T>[];
  placeholder?: string;
  initialValue?: T;
  maxItems?: number;
};

function matches<T>(term: string, option: SelectItem<T>): boolean {
  const t = term.toLowerCase();
  return (
    option.label.toLowerCase().includes(t) ||
    (option.hint ?? '').toLowerCase().includes(t) ||
    String(option.value).toLowerCase().includes(t)
  );
}

export class AutocompletePrompt<T> extends PromptBase<T> {
  private filtered: SelectItem<T>[];
  private cursor = 0;

  constructor(private readonly opts: AutocompletePromptOptions<T>) {
    super(opts);
    this.filtered = [...opts.options];
    if (opts.initialValue !== undefined) {
      const idx = this.filtered.findIndex((o) => o.value === opts.initialValue);
      if (idx !== -1) this.cursor = idx;
    }
  }

  private get focused(): SelectItem<T> | undefined {
    return this.filtered[this.cursor];
  }

  protected onKey(char: string | undefined, key: Key): void {
    if (key.name === 'up' || key.name === 'down') {
      const count = this.filtered.length;
      if (count > 0) {
        const step = key.name === 'up' ? -1 : 1;
        this.cursor = (this.cursor + step + count) % count;
      }
      return;
    }
    if (key.name === 'return') {
      if (this.focused) this.submit(this.focused.value);
      return;
    }
    const focusedValue = this.focused?.value;
    if (this.handleTextKey(char, key)) {
      this.filtered = this.userInput
        ? this.opts.options.filter((o) => matches(this.userInput, o))
        : [...this.opts.options];
      // Keep focus on the same option when it survives the filter.
      const idx = this.filtered.findIndex((o) => o.value === focusedValue);
      this.cursor = idx !== -1 ? idx : 0;
    }
  }

  protected render(): string {
    if (this.state === 'submit') {
      return submittedFrame(this.opts.message, this.focused?.label ?? '');
    }
    if (this.state === 'cancel') return cancelledFrame(this.opts.message);

    const showPlaceholder = this.userInput === '' && this.opts.placeholder;
    const searchText = showPlaceholder ? pc.dim(this.opts.placeholder!) : this.renderInput();
    const matchCount =
      this.filtered.length !== this.opts.options.length
        ? pc.dim(` (${this.filtered.length} match${this.filtered.length === 1 ? '' : 'es'})`)
        : '';

    const lines = [
      ...heading(this.state, this.opts.message),
      `${BAR}  ${pc.dim('Search:')} ${searchText}${matchCount}`,
    ];

    if (this.filtered.length === 0) {
      lines.push(`${BAR}  ${pc.yellow('No matches found')}`);
    } else {
      const max = defaultMaxVisible(this.output, 6, this.opts.maxItems);
      const win = windowItems(this.filtered.length, this.cursor, max);
      for (let i = win.start; i < win.end; i++) {
        const edge = (i === win.start && win.moreAbove) || (i === win.end - 1 && win.moreBelow);
        if (edge) {
          lines.push(`${BAR}  ${pc.dim('…')}`);
          continue;
        }
        const option = this.filtered[i]!;
        const active = i === this.cursor;
        const glyph = active ? RADIO_ACTIVE : RADIO_INACTIVE;
        const label = active ? option.label : pc.dim(option.label);
        lines.push(`${BAR}  ${glyph} ${label}${active ? dimHint(option.hint) : ''}`);
      }
    }

    lines.push(`${BAR}  ${pc.dim('↑/↓ select · enter confirm · type to search')}`);
    lines.push(BAR_END);
    return lines.join('\n');
  }
}
