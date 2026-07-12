/**
 * Prompt engine base.
 *
 * Owns the interaction loop every widget shares: raw-mode stdin with parsed
 * keypresses, a render loop that redraws the previous frame in place, cancel
 * semantics (ctrl-c / escape), and text-editing state for widgets that take
 * typed input. Widgets subclass this and implement render() + onKey().
 *
 * Streams are injectable so tests can drive prompts with a PassThrough and
 * capture output without a TTY.
 */

import { emitKeypressEvents, type Key } from 'node:readline';
import pc from 'picocolors';

export const CANCEL: unique symbol = Symbol('prompt.cancel');

export type PromptState = 'active' | 'error' | 'submit' | 'cancel';

export type PromptIO = {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
};

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

type RawModeStream = NodeJS.ReadableStream & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => void;
};

export abstract class PromptBase<T> {
  state: PromptState = 'active';
  errorMessage = '';

  protected readonly input: RawModeStream;
  protected readonly output: NodeJS.WritableStream;

  /** Typed input for text-taking widgets (text, autocomplete). */
  protected userInput = '';
  protected textCursor = 0;

  private value!: T;
  private prevHeight = 0;

  constructor(io: PromptIO = {}) {
    this.input = (io.input ?? process.stdin) as RawModeStream;
    this.output = io.output ?? process.stdout;
  }

  /** Produce the current frame. Called after every keypress. */
  protected abstract render(): string;

  /** Handle a keypress. Call submit()/fail() to change state. */
  protected abstract onKey(char: string | undefined, key: Key): void;

  protected submit(value: T): void {
    this.value = value;
    this.state = 'submit';
  }

  protected fail(message: string): void {
    this.state = 'error';
    this.errorMessage = message;
  }

  prompt(): Promise<T | typeof CANCEL> {
    return new Promise((resolve) => {
      emitKeypressEvents(this.input);
      const wasRaw = this.setRawMode(true);
      this.input.resume?.();
      this.output.write(HIDE_CURSOR);
      this.draw();

      const onKeypress = (char: string | undefined, key: Key | undefined): void => {
        const k = key ?? { name: undefined, sequence: char };
        if ((k.ctrl && k.name === 'c') || k.name === 'escape') {
          this.state = 'cancel';
        } else {
          // A keypress after a validation error clears it.
          if (this.state === 'error') this.state = 'active';
          this.onKey(char, k as Key);
        }

        this.draw();

        if (this.state === 'submit' || this.state === 'cancel') {
          this.input.off('keypress', onKeypress);
          this.setRawMode(wasRaw);
          this.input.pause?.();
          this.output.write('\n' + SHOW_CURSOR);
          resolve(this.state === 'submit' ? this.value : CANCEL);
        }
      };

      this.input.on('keypress', onKeypress);
    });
  }

  /**
   * Common line-editing for typed input. Returns true when the key mutated
   * the input, so widgets can react to filter changes.
   */
  protected handleTextKey(char: string | undefined, key: Key): boolean {
    const before = this.userInput;
    switch (key.name) {
      case 'backspace':
        if (this.textCursor > 0) {
          this.userInput =
            this.userInput.slice(0, this.textCursor - 1) + this.userInput.slice(this.textCursor);
          this.textCursor--;
        }
        break;
      case 'delete':
        this.userInput =
          this.userInput.slice(0, this.textCursor) + this.userInput.slice(this.textCursor + 1);
        break;
      case 'left':
        this.textCursor = Math.max(0, this.textCursor - 1);
        break;
      case 'right':
        this.textCursor = Math.min(this.userInput.length, this.textCursor + 1);
        break;
      case 'home':
        this.textCursor = 0;
        break;
      case 'end':
        this.textCursor = this.userInput.length;
        break;
      default:
        if (char && !key.ctrl && !key.meta && char >= ' ') {
          this.userInput =
            this.userInput.slice(0, this.textCursor) + char + this.userInput.slice(this.textCursor);
          this.textCursor += char.length;
        }
    }
    return this.userInput !== before;
  }

  /** The typed input with an inverse-video cursor block. */
  protected renderInput(): string {
    if (this.userInput === '') return pc.inverse(' ');
    if (this.textCursor >= this.userInput.length) return `${this.userInput}${pc.inverse(' ')}`;
    return (
      this.userInput.slice(0, this.textCursor) +
      pc.inverse(this.userInput[this.textCursor]!) +
      this.userInput.slice(this.textCursor + 1)
    );
  }

  private draw(): void {
    const frame = this.render();
    if (this.prevHeight > 0) {
      const up = this.prevHeight - 1;
      this.output.write('\r' + (up > 0 ? `\x1b[${up}A` : '') + '\x1b[J');
    }
    this.output.write(frame);
    this.prevHeight = frame.split('\n').length;
  }

  private setRawMode(mode: boolean): boolean {
    if (this.input.isTTY && this.input.setRawMode) {
      const was = (this.input as unknown as { isRaw?: boolean }).isRaw ?? false;
      this.input.setRawMode(mode);
      return was;
    }
    return false;
  }
}
