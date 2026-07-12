/**
 * Multi-select prompt: checkbox list with space to toggle, `a` to toggle all,
 * enter to submit. Group headers render as non-focusable rows.
 */

import type { Key } from 'node:readline';
import pc from 'picocolors';
import { PromptBase, type PromptIO } from './prompt';
import {
  BAR,
  BAR_END,
  CHECKBOX_SELECTED,
  CHECKBOX_UNSELECTED,
  heading,
  submittedFrame,
  cancelledFrame,
  windowItems,
  defaultMaxVisible,
  dimHint,
} from './render';
import { buildRows, type SelectItem } from './select';

export type MultiselectPromptOptions<T> = PromptIO & {
  message: string;
  options: SelectItem<T>[];
  initialValues?: T[];
  required?: boolean;
  maxItems?: number;
};

export class MultiselectPrompt<T> extends PromptBase<T[]> {
  private readonly rows: ReturnType<typeof buildRows<T>>;
  private readonly optionIndexes: number[];
  private readonly selected = new Set<number>();
  private cursor = 0;

  constructor(private readonly opts: MultiselectPromptOptions<T>) {
    super(opts);
    this.rows = buildRows(opts.options);
    this.optionIndexes = this.rows
      .map((row, i) => (row.type === 'option' ? i : -1))
      .filter((i) => i !== -1);
    if (opts.initialValues) {
      for (const [pos, rowIndex] of this.optionIndexes.entries()) {
        const row = this.rows[rowIndex]! as { option: SelectItem<T> };
        if (opts.initialValues.includes(row.option.value)) this.selected.add(pos);
      }
    }
  }

  private optionAt(pos: number): SelectItem<T> {
    return (this.rows[this.optionIndexes[pos]!]! as { option: SelectItem<T> }).option;
  }

  private selectedValues(): T[] {
    return [...this.selected].sort((a, b) => a - b).map((pos) => this.optionAt(pos).value);
  }

  protected onKey(char: string | undefined, key: Key): void {
    const count = this.optionIndexes.length;
    if (key.name === 'up') {
      this.cursor = (this.cursor - 1 + count) % count;
    } else if (key.name === 'down') {
      this.cursor = (this.cursor + 1) % count;
    } else if (key.name === 'space') {
      if (this.selected.has(this.cursor)) this.selected.delete(this.cursor);
      else this.selected.add(this.cursor);
    } else if (char === 'a') {
      if (this.selected.size === count) this.selected.clear();
      else for (let i = 0; i < count; i++) this.selected.add(i);
    } else if (key.name === 'return') {
      if (this.opts.required && this.selected.size === 0) {
        this.fail('Select at least one option (space to toggle)');
        return;
      }
      this.submit(this.selectedValues());
    }
  }

  protected render(): string {
    if (this.state === 'submit') {
      const labels = [...this.selected]
        .sort((a, b) => a - b)
        .map((pos) => this.optionAt(pos).label);
      return submittedFrame(this.opts.message, labels.length > 0 ? labels.join(', ') : 'none');
    }
    if (this.state === 'cancel') return cancelledFrame(this.opts.message);

    const lines = heading(this.state, this.opts.message);
    const focusedRowIndex = this.optionIndexes[this.cursor]!;
    const max = defaultMaxVisible(this.output, 5, this.opts.maxItems);
    const win = windowItems(this.rows.length, focusedRowIndex, max);

    for (let i = win.start; i < win.end; i++) {
      const row = this.rows[i]!;
      const edge = (i === win.start && win.moreAbove) || (i === win.end - 1 && win.moreBelow);
      if (edge) {
        lines.push(`${BAR}  ${pc.dim('…')}`);
        continue;
      }
      if (row.type === 'header') {
        lines.push(`${BAR}  ${pc.dim(pc.bold(row.label))}`);
        continue;
      }
      const pos = this.optionIndexes.indexOf(i);
      const active = i === focusedRowIndex;
      const box = this.selected.has(pos) ? CHECKBOX_SELECTED : CHECKBOX_UNSELECTED;
      const label = active ? row.option.label : pc.dim(row.option.label);
      const hint = active ? dimHint(row.option.hint) : '';
      lines.push(`${BAR}  ${box} ${label}${hint}`);
    }

    if (this.state === 'error') {
      lines.push(`${BAR}  ${pc.yellow(this.errorMessage)}`);
    }
    lines.push(`${BAR}  ${pc.dim('space toggle · a all · enter confirm')}`);
    lines.push(BAR_END);
    return lines.join('\n');
  }
}
