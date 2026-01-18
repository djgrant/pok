/**
 * Prompter Interface
 *
 * Defines the contract for interactive user input adapters.
 * This is the "input" side of the CLI - blocking calls that wait for user response.
 *
 * Implementations: @pokit/prompter-clack
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
};

// =============================================================================
// Dynamic Options Provider Types (Lazy Loading)
// =============================================================================

/**
 * Result page from a dynamic options provider.
 *
 * @template T - The type of the option's value
 */
export type OptionsPage<T> = {
  /** Options for this page */
  options: SelectOption<T>[];
  /**
   * Cursor for fetching next page.
   * Undefined/null means no more pages available.
   */
  nextCursor?: string | null;
  /**
   * Total count if known (for progress display).
   * Optional - only set if the provider knows the total.
   */
  totalCount?: number;
};

/**
 * Request context passed to option providers.
 */
export type OptionsRequest = {
  /**
   * Cursor from previous page's nextCursor.
   * Undefined on first request.
   */
  cursor?: string;
  /**
   * Current filter/search text from typeahead.
   * Only set if user has typed a filter.
   */
  filter?: string;
  /**
   * AbortSignal for cancellation.
   * Provider should check signal.aborted and abort fetch if true.
   */
  signal: AbortSignal;
};

/**
 * Provider capabilities declaration.
 * Allows prompter to adapt UI based on provider features.
 */
export type ProviderCapabilities = {
  /**
   * When true, provider handles filtering server-side.
   * When false/undefined, prompter filters loaded options client-side.
   */
  supportsFilter?: boolean;
  /**
   * Debounce time in ms for filter requests.
   * Only used when supportsFilter is true.
   * @default 150
   */
  filterDebounceMs?: number;
};

/**
 * Dynamic options provider function.
 *
 * @template T - The type of the option's value
 */
export type OptionsProvider<T> = {
  (request: OptionsRequest): Promise<OptionsPage<T>>;
  /** Optional capabilities declaration */
  capabilities?: ProviderCapabilities;
};

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
   * Called initially and again when loading more or filtering.
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
   * Label for the "load more" option when pagination is available.
   * @default "Load more..."
   */
  loadMoreLabel?: string;
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
export function isDynamicOptions<T>(
  options: SelectOptions<T>
): options is DynamicSelectOptions<T> {
  return 'provider' in options;
}

/**
 * Create a provider with declared capabilities.
 * Utility for setting capabilities in a type-safe way.
 */
export function withCapabilities<T>(
  provider: (request: OptionsRequest) => Promise<OptionsPage<T>>,
  capabilities: ProviderCapabilities
): OptionsProvider<T> {
  const fn = provider as OptionsProvider<T>;
  fn.capabilities = capabilities;
  return fn;
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
}
