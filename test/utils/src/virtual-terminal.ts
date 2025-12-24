/**
 * Virtual Terminal for Testing
 *
 * Uses xterm-headless to simulate a terminal in memory.
 * Captures stdout and allows "screenshots" of the terminal state.
 */

import { Terminal } from '@xterm/headless';

export type VirtualTerminal = {
  /** Take a "screenshot" - get current terminal state as lines (async due to xterm buffering) */
  screenshot(): Promise<string[]>;
  /** Get screenshot as single string (async due to xterm buffering) */
  screenshotText(): Promise<string>;
  /** Restore original stdout.write */
  restore(): void;
  /** Get raw captured output (with ANSI codes) */
  raw(): string;
};

/**
 * Create a virtual terminal that intercepts stdout and simulates terminal rendering.
 *
 * @param cols - Terminal width in columns (default: 80)
 * @param rows - Terminal height in rows (default: 24)
 * @returns VirtualTerminal instance
 *
 * @example
 * ```ts
 * const vt = createVirtualTerminal();
 *
 * // ... code that writes to stdout ...
 *
 * const screen = await vt.screenshotText();
 * expect(screen).toContain('Hello');
 *
 * vt.restore(); // Always restore!
 * ```
 */
export function createVirtualTerminal(cols = 80, rows = 24): VirtualTerminal {
  const term = new Terminal({
    cols,
    rows,
    convertEol: true,
    allowProposedApi: true,
  });
  const chunks: string[] = [];
  // Track pending writes so we can wait for them
  let pendingWrites: Promise<void>[] = [];

  const original = process.stdout.write.bind(process.stdout);

  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    chunks.push(str);

    // xterm.write is async - we need to track when it completes
    const writePromise = new Promise<void>((resolve) => {
      term.write(str, resolve);
    });
    pendingWrites.push(writePromise);

    return true;
  };

  /**
   * Wait for all pending writes to complete
   */
  async function flush(): Promise<void> {
    await Promise.all(pendingWrites);
    pendingWrites = [];
  }

  return {
    async screenshot(): Promise<string[]> {
      await flush();

      const lines: string[] = [];
      const buffer = term.buffer.active;
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true)); // trimRight=true
        }
      }
      // Trim trailing empty lines
      while (lines.length && !lines[lines.length - 1]) {
        lines.pop();
      }
      return lines;
    },

    async screenshotText(): Promise<string> {
      const lines = await this.screenshot();
      return lines.join('\n');
    },

    restore(): void {
      process.stdout.write = original;
    },

    raw(): string {
      return chunks.join('');
    },
  };
}
