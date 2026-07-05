/**
 * Prompter Module
 *
 * Exports the Prompter interface for interactive user input.
 */

export type {
  Prompter,
  SelectOption,
  SelectOptions,
  // Dynamic options types
  StaticSelectOptions,
  DynamicSelectOptions,
  OptionsProvider,
  // Other prompt types
  MultiselectOption,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
  AutocompleteOptions,
} from './types';

export { isDynamicOptions } from './types';

// Navigator (menu presentation policy)
export type {
  Navigator,
  NavOption,
  NavResult,
  NavContext,
} from './navigator';
export { createMenuNavigator } from './navigator';

// Raw Prompter (for testing and non-TTY environments)
export type { PromptCall, ResponseProvider, RawPrompterOptions, RawPrompter } from './prompter.raw';
export { createRawPrompter } from './prompter.raw';
