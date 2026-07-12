/**
 * Frame: the one component allowed to draw the rail.
 *
 * Holds a single piece of state — whether a box is open — and renders every
 * visual form the reporter needs: box open/close, lines inside the box, and
 * standalone blocks outside it. Multi-line content is split here so
 * continuation indentation lives in exactly one place.
 */

import type { Theme, LineKind } from './theme';

export class Frame {
  private boxOpen = false;
  private lastLineBlank = true;

  constructor(
    private readonly theme: Theme,
    private readonly writeLine: (line: string) => void
  ) {}

  get isOpen(): boolean {
    return this.boxOpen;
  }

  open(label: string): void {
    if (!this.lastLineBlank) this.write('');
    this.write(this.theme.open(label));
    this.boxOpen = true;
  }

  close(status: 'done' | 'failed'): void {
    this.spacer();
    this.write(this.theme.close(status));
    this.write('');
    this.boxOpen = false;
  }

  /**
   * Draw an element inside the box. Falls back to a standalone block when no
   * box is open, so out-of-box output has defined semantics rather than an
   * orphaned rail fragment.
   */
  line(kind: LineKind, text: string): void {
    if (!this.boxOpen) {
      this.block(kind, text);
      return;
    }
    const [first = '', ...rest] = text.split('\n');
    this.spacer();
    this.write(this.theme.line(kind, first));
    for (const cont of rest) {
      this.write(this.theme.continuation(cont));
    }
  }

  /** Draw a standalone block outside any box, separated by a blank line. */
  block(kind: LineKind, text: string): void {
    if (!this.lastLineBlank) this.write('');
    const [first = '', ...rest] = text.split('\n');
    this.write(this.theme.block(kind, first));
    for (const cont of rest) {
      this.write(this.theme.blockContinuation(cont));
    }
    this.write('');
  }

  /** Raw passthrough for pre-rendered content (markdown documents). */
  raw(text: string): void {
    for (const line of text.split('\n')) {
      this.write(line);
    }
  }

  private spacer(): void {
    if (this.theme.spacer !== null) this.write(this.theme.spacer);
  }

  private write(line: string): void {
    this.writeLine(line);
    this.lastLineBlank = line === '';
  }
}
