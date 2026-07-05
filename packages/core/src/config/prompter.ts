/**
 * Prompter contract re-export.
 *
 * The canonical prompter contract lives in `../prompter`. This module used to
 * carry a parallel copy of those types, which drifted out of sync. It now
 * simply re-exports the single source of truth so config consumers keep the
 * same import surface.
 */

export type {
  Prompter,
  SelectOption,
  SelectOptions,
  StaticSelectOptions,
  DynamicSelectOptions,
  OptionsProvider,
  MultiselectOption,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
  AutocompleteOptions,
} from '../prompter';

export { isDynamicOptions } from '../prompter';
