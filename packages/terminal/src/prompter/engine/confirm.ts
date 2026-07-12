/**
 * Confirm prompt: yes/no toggle. Arrows and tab move, y/n jump, enter submits.
 */

import type { Key } from 'node:readline';
import { PromptBase, type PromptIO } from './prompt';
import {
  BAR,
  BAR_END,
  RADIO_ACTIVE,
  RADIO_INACTIVE,
  heading,
  submittedFrame,
  cancelledFrame,
} from './render';
import pc from 'picocolors';

export type ConfirmPromptOptions = PromptIO & {
  message: string;
  initialValue?: boolean;
};

export class ConfirmPrompt extends PromptBase<boolean> {
  private choice: boolean;

  constructor(private readonly opts: ConfirmPromptOptions) {
    super(opts);
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
    if (this.state === 'submit') return submittedFrame(this.opts.message, this.choice ? 'Yes' : 'No');
    if (this.state === 'cancel') return cancelledFrame(this.opts.message);

    const yes = this.choice
      ? `${RADIO_ACTIVE} Yes`
      : `${RADIO_INACTIVE} ${pc.dim('Yes')}`;
    const no = !this.choice ? `${RADIO_ACTIVE} No` : `${RADIO_INACTIVE} ${pc.dim('No')}`;
    return [
      ...heading(this.state, this.opts.message),
      `${BAR}  ${yes} ${pc.dim('/')} ${no}`,
      BAR_END,
    ].join('\n');
  }
}
