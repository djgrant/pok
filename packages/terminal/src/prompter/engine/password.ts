/**
 * Password prompt: masked line editing with on-submit validation. The typed
 * value is never written to the output — each character echoes as the mask,
 * and the closed frame shows a fixed-length mask so the length isn't leaked.
 */

import type { Key } from 'node:readline';
import pc from 'picocolors';
import { PromptBase, type PromptIO } from './prompt';
import { defaultPromptTheme, type PromptTheme } from './render';

export type PasswordPromptOptions = PromptIO & {
  message: string;
  mask?: string;
  validate?: (value: string) => string | undefined;
  theme?: PromptTheme;
};

const SUBMITTED_MASK_LENGTH = 8;

export class PasswordPrompt extends PromptBase<string> {
  private readonly theme: PromptTheme;
  private readonly mask: string;

  constructor(private readonly opts: PasswordPromptOptions) {
    super(opts);
    this.theme = opts.theme ?? defaultPromptTheme;
    this.mask = opts.mask ?? '*';
  }

  protected onKey(char: string | undefined, key: Key): void {
    if (key.name === 'return') {
      const error = this.opts.validate?.(this.userInput);
      if (error) {
        this.fail(error);
        return;
      }
      this.submit(this.userInput);
      return;
    }
    this.handleTextKey(char, key);
  }

  protected render(): string {
    const t = this.theme;
    if (this.state === 'submit') {
      return t.submitted(this.opts.message, this.mask.repeat(SUBMITTED_MASK_LENGTH));
    }
    if (this.state === 'cancel') return t.cancelled(this.opts.message);

    const lines = [...t.heading(this.state, this.opts.message), t.item(this.renderMasked())];
    if (this.state === 'error') {
      lines.push(t.problem(this.errorMessage));
    }
    lines.push(...t.end());
    return lines.join('\n');
  }

  /** The input as mask characters with an inverse-video cursor block. */
  private renderMasked(): string {
    if (this.mask === '') return pc.inverse(' ');
    const length = this.userInput.length;
    const cursor = this.textCursor;
    if (cursor >= length) return `${this.mask.repeat(length)}${pc.inverse(' ')}`;
    return (
      this.mask.repeat(cursor) + pc.inverse(this.mask) + this.mask.repeat(length - cursor - 1)
    );
  }
}
