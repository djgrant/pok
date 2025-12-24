/**
 * Prompter Module
 *
 * Exports the Prompter interface for interactive user input.
 */

export type {
  Prompter,
  SelectOption,
  SelectOptions,
  MultiselectOption,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
} from './types';

// Raw Prompter (for testing and non-TTY environments)
export type { PromptCall, ResponseProvider, RawPrompterOptions, RawPrompter } from './prompter.raw';
export { createRawPrompter } from './prompter.raw';
