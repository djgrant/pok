/**
 * Confirm prompt: yes/no toggle. Arrows and tab move, y/n jump, enter submits.
 */

import type { Key } from 'node:readline';
import pc from 'picocolors';
import { PromptBase, type PromptIO } from './prompt';
import { defaultPromptTheme, type PromptTheme } from './render';

export type ConfirmPromptOptions = PromptIO & {
  message: string;
  initialValue?: boolean;
  theme?: PromptTheme;
};

export class ConfirmPrompt extends PromptBase<boolean> {
  private readonly theme: PromptTheme;
  private choice: boolean;

  constructor(private readonly opts: ConfirmPromptOptions) {
    super(opts);
    this.theme = opts.theme ?? defaultPromptTheme;
    this.choice = opts.initialValue ?? false;
  }

  protected onKey(char: string | undefined, key: Key): void {
    if (
      key.name === 'left' ||
      key.name === 'right' ||
      key.name === 'up' ||
      key.name === 'down' ||
      key.name === 'tab'
    ) {
      this.choice = !this.choice;
    } else if (char === 'y' || char === 'Y') {
      this.choice = true;
      this.submit(true);
    } else if (char === 'n' || char === 'N') {
      this.choice = false;
      this.submit(false);
    } else if (key.name === 'return') {
      this.submit(this.choice);
    }
  }

  protected render(): string {
    const t = this.theme;
    if (this.state === 'submit') return t.submitted(this.opts.message, this.choice ? 'Yes' : 'No');
    if (this.state === 'cancel') return t.cancelled(this.opts.message);

    const yes = this.choice ? `${t.radio(true)} Yes` : `${t.radio(false)} ${t.palette.dim('Yes')}`;
    const no = !this.choice ? `${t.radio(true)} No` : `${t.radio(false)} ${t.palette.dim('No')}`;
    return [
      ...t.heading(this.state, this.opts.message),
      t.item(`${yes} ${pc.dim('/')} ${no}`),
      ...t.end(),
    ].join('\n');
  }
}
