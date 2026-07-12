/**
 * Text input prompt: line editing with placeholder, initial value, and
 * on-submit validation.
 */

import type { Key } from 'node:readline';
import pc from 'picocolors';
import { PromptBase, type PromptIO } from './prompt';
import { defaultPromptTheme, type PromptTheme } from './render';

export type TextPromptOptions = PromptIO & {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
  theme?: PromptTheme;
};

export class TextPrompt extends PromptBase<string> {
  private readonly theme: PromptTheme;

  constructor(private readonly opts: TextPromptOptions) {
    super(opts);
    this.theme = opts.theme ?? defaultPromptTheme;
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
    const t = this.theme;
    if (this.state === 'submit') return t.submitted(this.opts.message, this.userInput);
    if (this.state === 'cancel') return t.cancelled(this.opts.message);

    const showPlaceholder = this.userInput === '' && this.opts.placeholder;
    const inputLine = showPlaceholder
      ? `${pc.inverse(this.opts.placeholder![0] ?? ' ')}${t.palette.dim(this.opts.placeholder!.slice(1))}`
      : this.renderInput();

    const lines = [...t.heading(this.state, this.opts.message), t.item(inputLine)];
    if (this.state === 'error') {
      lines.push(t.problem(this.errorMessage));
    }
    lines.push(...t.end());
    return lines.join('\n');
  }
}
