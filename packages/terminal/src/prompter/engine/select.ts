/**
 * Single-select prompt: arrow navigation over a windowed radio list, with
 * optional group headers rendered as non-focusable rows.
 */

import type { Key } from 'node:readline';
import pc from 'picocolors';
import { PromptBase, type PromptIO } from './prompt';
import {
  defaultPromptTheme,
  type PromptTheme,
  windowItems,
  defaultMaxVisible,
  dimHint,
} from './render';

export type SelectItem<T> = {
  value: T;
  label: string;
  hint?: string;
  group?: string;
};

export type SelectPromptOptions<T> = PromptIO & {
  message: string;
  options: SelectItem<T>[];
  initialValue?: T;
  maxItems?: number;
  theme?: PromptTheme;
};

type Row<T> = { type: 'header'; label: string } | { type: 'option'; option: SelectItem<T> };

/** Build display rows, inserting a header before each new group. */
export function buildRows<T>(options: SelectItem<T>[]): Row<T>[] {
  const rows: Row<T>[] = [];
  let currentGroup: string | undefined;
  const hasGroups = options.some((o) => o.group);
  for (const option of options) {
    if (hasGroups && option.group !== currentGroup) {
      currentGroup = option.group;
      if (option.group) rows.push({ type: 'header', label: option.group });
    }
    rows.push({ type: 'option', option });
  }
  return rows;
}

export class SelectPrompt<T> extends PromptBase<T> {
  private readonly rows: Row<T>[];
  private readonly optionIndexes: number[];
  private readonly theme: PromptTheme;
  private cursor = 0;

  constructor(private readonly opts: SelectPromptOptions<T>) {
    super(opts);
    this.theme = opts.theme ?? defaultPromptTheme;
    this.rows = buildRows(opts.options);
    this.optionIndexes = this.rows
      .map((row, i) => (row.type === 'option' ? i : -1))
      .filter((i) => i !== -1);
    if (opts.initialValue !== undefined) {
      const idx = this.optionIndexes.findIndex(
        (i) => (this.rows[i] as { option: SelectItem<T> }).option.value === opts.initialValue
      );
      if (idx !== -1) this.cursor = idx;
    }
  }

  private get focused(): SelectItem<T> {
    const row = this.rows[this.optionIndexes[this.cursor]!]! as {
      option: SelectItem<T>;
    };
    return row.option;
  }

  protected onKey(_char: string | undefined, key: Key): void {
    const count = this.optionIndexes.length;
    if (key.name === 'up' || key.name === 'k') {
      this.cursor = (this.cursor - 1 + count) % count;
    } else if (key.name === 'down' || key.name === 'j') {
      this.cursor = (this.cursor + 1) % count;
    } else if (key.name === 'return') {
      this.submit(this.focused.value);
    }
  }

  protected render(): string {
    const t = this.theme;
    if (this.state === 'submit') return t.submitted(this.opts.message, this.focused.label);
    if (this.state === 'cancel') return t.cancelled(this.opts.message);

    const lines = t.heading(this.state, this.opts.message);
    const focusedRowIndex = this.optionIndexes[this.cursor]!;
    const max = defaultMaxVisible(this.output, 4, this.opts.maxItems);
    const win = windowItems(this.rows.length, focusedRowIndex, max);

    for (let i = win.start; i < win.end; i++) {
      const row = this.rows[i]!;
      const edge = (i === win.start && win.moreAbove) || (i === win.end - 1 && win.moreBelow);
      if (edge) {
        lines.push(t.ellipsis());
        continue;
      }
      if (row.type === 'header') {
        lines.push(t.item(t.palette.dim(pc.bold(row.label))));
        continue;
      }
      const active = i === focusedRowIndex;
      const label = active ? row.option.label : t.palette.dim(row.option.label);
      const hint = active ? dimHint(row.option.hint) : '';
      lines.push(t.item(`${t.radio(active)} ${label}${hint}`));
    }

    lines.push(...t.end());
    return lines.join('\n');
  }
}
