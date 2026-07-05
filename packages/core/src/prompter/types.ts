/**
 * Prompter Interface
 *
 * Defines the contract for interactive user input adapters.
 */

// =============================================================================
// Option Types
// =============================================================================

/**
 * A single option in a select prompt.
 *
 * @template T - The type of the option's value
 */
export type SelectOption<T> = {
  /** The value returned when this option is selected */
  value: T;
  /** The label displayed to the user */
  label: string;
  /** Optional hint text displayed alongside the label */
  hint?: string;
  /** Optional group name for visual grouping (like HTML <optgroup>) */
  group?: string;
};

// =============================================================================
// Dynamic Options Provider Types (Lazy Loading)
// =============================================================================

/**
 * Dynamic options provider function.
 *
 * Given an optional filter string (the user's current type-ahead query) and an
 * AbortSignal, resolves to the full set of options to display. The UI adapter
 * decides how to present loading and filtering — pagination, debounce, and
 * server-vs-client filtering are implementation details of the UI, not the
 * contract.
 *
 * @template T - The type of the option's value
 */
export type OptionsProvider<T> = (
  filter: string | undefined,
  signal: AbortSignal
) => Promise<SelectOption<T>[]>;

/**
 * Static options configuration (current behavior).
 *
 * @template T - The type of values in the options
 */
export type StaticSelectOptions<T> = {
  /** The prompt message displayed to the user */
  message: string;
  /**
   * The list of options to display.
   * MUST contain at least one option.
   */
  options: SelectOption<T>[];
  /**
   * Optional initial value to pre-select.
   * If provided, MUST match one of the option values.
   * If not found in options, implementations SHOULD ignore it.
   */
  initialValue?: T;
};

/**
 * Dynamic options configuration (new).
 *
 * @template T - The type of values in the options
 */
export type DynamicSelectOptions<T> = {
  /** The prompt message displayed to the user */
  message: string;
  /**
   * Provider function for lazy-loading options.
   * Called with the current filter (if any) and an AbortSignal.
   */
  provider: OptionsProvider<T>;
  /** Initial value to pre-select (if found in loaded options) */
  initialValue?: T;
  /**
   * Placeholder text shown while loading initial options.
   * @default "Loading..."
   */
  loadingMessage?: string;
  /**
   * Error message shown when provider fails.
   * @default "Failed to load options"
   */
  errorMessage?: string;
};

/**
 * Options for the select prompt.
 * Supports both static options array and dynamic provider.
 *
 * @template T - The type of values in the options
 */
export type SelectOptions<T> = StaticSelectOptions<T> | DynamicSelectOptions<T>;

/**
 * Type guard for dynamic options
 */
export function isDynamicOptions<T>(options: SelectOptions<T>): options is DynamicSelectOptions<T> {
  return 'provider' in options;
}

/**
 * Options for the confirm prompt.
 */
export type ConfirmOptions = {
  /** The prompt message displayed to the user */
  message: string;
  /**
   * Optional initial value (default selection).
   * true = yes pre-selected, false = no pre-selected.
   * If not provided, implementations SHOULD default to false (no).
   */
  initialValue?: boolean;
};

/**
 * Options for the text input prompt.
 */
export type TextOptions = {
  /** The prompt message displayed to the user */
  message: string;
  /** Optional placeholder text shown when input is empty */
  placeholder?: string;
  /** Optional initial value pre-filled in the input */
  initialValue?: string;
  /**
   * Optional validation function.
   *
   * @param value - The current input value
   * @returns undefined if valid, or an error message string if invalid
   */
  validate?: (value: string) => string | undefined;
};

/**
 * A single option in a multiselect prompt.
 *
 * @template T - The type of the option's value
 */
export type MultiselectOption<T> = {
  /** The value included in the result array when this option is selected */
  value: T;
  /** The label displayed to the user */
  label: string;
  /** Optional hint text displayed alongside the label */
  hint?: string;
  /** Optional group name for visual grouping */
  group?: string;
};

/**
 * Options for the multiselect prompt.
 *
 * @template T - The type of values in the options
 */
export type MultiselectOptions<T> = {
  /** The prompt message displayed to the user */
  message: string;
  /**
   * The list of options to display.
   * MUST contain at least one option.
   */
  options: MultiselectOption<T>[];
  /**
   * Optional array of initially selected values.
   * Values not found in options SHOULD be ignored.
   */
  initialValues?: T[];
  /**
   * If true, at least one option MUST be selected.
   * The prompt MUST NOT resolve with an empty array.
   * If the user tries to submit with nothing selected, an error SHOULD be shown.
   */
  required?: boolean;
};

/**
 * Options for the autocomplete prompt.
 * A single-select prompt with type-ahead search filtering.
 *
 * @template T - The type of values in the options
 */
export type AutocompleteOptions<T> = {
  /** The prompt message displayed to the user */
  message: string;
  /**
   * The list of options to display and filter.
   * MUST contain at least one option.
   */
  options: SelectOption<T>[];
  /**
   * Optional placeholder text shown in the search input.
   */
  placeholder?: string;
  /**
   * Maximum number of items to display at once.
   */
  maxItems?: number;
};

/**
 * Prompter interface for interactive user input.
 */
export interface Prompter {
  /**
   * Display a selection prompt with multiple options.
   */
  select<T>(options: SelectOptions<T>): Promise<T>;

  /**
   * Display a multi-selection prompt allowing multiple choices.
   */
  multiselect<T>(options: MultiselectOptions<T>): Promise<T[]>;

  /**
   * Display a confirmation prompt (yes/no).
   */
  confirm(options: ConfirmOptions): Promise<boolean>;

  /**
   * Display a text input prompt.
   */
  text(options: TextOptions): Promise<string>;

  /**
   * Display a single-select prompt with type-ahead search filtering.
   * Optional — implementations that don't support it can omit this method.
   * Callers should fall back to `select` when unavailable.
   */
  autocomplete?<T>(options: AutocompleteOptions<T>): Promise<T>;
}
