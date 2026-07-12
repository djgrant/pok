/**
 * Text input prompt: line editing with placeholder, initial value, and
 * on-submit validation.
 */

import type { Key } from 'node:readline';
import pc from 'picocolors';
import { PromptBase, type PromptIO } from './prompt';
import { BAR, BAR_END, heading, submittedFrame, cancelledFrame } from './render';

export type TextPromptOptions = PromptIO & {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
};

export class TextPrompt extends PromptBase<string> {
  constructor(private readonly opts: TextPromptOptions) {
    super(opts);
    if (opts.initialValue) {
      this.userInput = opts.initialValue;
      this.textCursor = opts.initialValue.length;
    }
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
    if (this.state === 'submit') return submittedFrame(this.opts.message, this.userInput);
    if (this.state === 'cancel') return cancelledFrame(this.opts.message);

    const showPlaceholder = this.userInput === '' && this.opts.placeholder;
    const inputLine = showPlaceholder
      ? `${pc.inverse(this.opts.placeholder![0] ?? ' ')}${pc.dim(this.opts.placeholder!.slice(1))}`
      : this.renderInput();

    const lines = [...heading(this.state, this.opts.message), `${BAR}  ${inputLine}`];
    if (this.state === 'error') {
      lines.push(`${BAR}  ${pc.yellow(this.errorMessage)}`);
    }
    lines.push(BAR_END);
    return lines.join('\n');
  }
}
