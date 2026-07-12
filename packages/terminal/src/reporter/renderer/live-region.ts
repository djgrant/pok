/**
 * Live region: owns the last row of the screen for in-flight work.
 *
 * All static output flows through writeLine(). When a live row is active,
 * writeLine erases it, prints the static line, and redraws the live row
 * beneath — so logs and completions can interleave with a running spinner
 * without any buffering.
 *
 * When disabled (non-interactive output), start/update are no-ops and
 * writeLine passes straight through, giving line-based output for free.
 */

import type { Theme } from './theme';

const TICK_MS = 80;
const ERASE_LINE = '\r\x1b[2K';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

export class LiveRegion {
  private active = false;
  private text = '';
  private frameIdx = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly enabled: boolean,
    private readonly theme: Theme,
    private readonly out: { write(s: string): unknown; columns?: number } = process.stdout
  ) {}

  writeLine(line: string): void {
    if (this.active) this.out.write(ERASE_LINE);
    this.out.write(line + '\n');
    if (this.active) this.render();
  }

  start(text: string): void {
    if (!this.enabled) return;
    this.text = text;
    if (!this.active) {
      this.active = true;
      this.out.write(HIDE_CURSOR);
      this.timer = setInterval(() => {
        this.frameIdx = (this.frameIdx + 1) % this.theme.spinnerFrames.length;
        this.render();
      }, TICK_MS);
    }
    this.render();
  }

  update(text: string): void {
    if (!this.active) return;
    this.text = text;
    this.render();
  }

  stop(): void {
    if (!this.active) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.active = false;
    this.out.write(ERASE_LINE + SHOW_CURSOR);
  }

  private render(): void {
    const frame = this.theme.spinnerFrames[this.frameIdx]!;
    // Truncate to one row so erasing with a single ERASE_LINE stays correct.
    const width = this.out.columns && this.out.columns > 0 ? this.out.columns : 80;
    const line = this.theme.liveLine(frame, this.text).slice(0, width - 1);
    this.out.write(ERASE_LINE + line);
  }
}
