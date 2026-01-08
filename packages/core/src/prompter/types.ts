/**
 * Prompter Interface
 *
 * Defines the contract for interactive user input adapters.
 * This is the "input" side of the CLI - blocking calls that wait for user response.
 *
 * Implementations: @pokit/prompter-clack
 *
 * ## Behavioral Contract
 *
 * ### General Requirements
 *
 * All prompt methods:
 * - MUST display a user-facing prompt and wait for input
 * - MUST return a Promise that resolves with the user's response
 * - MUST handle terminal resize events gracefully
 * - SHOULD restore terminal state after completion (cursor visibility, raw mode)
 *
 * ### Cancellation Semantics
 *
 * When the user cancels a prompt (e.g., Ctrl+C):
 * - The implementation MUST handle cancellation gracefully
 * - The implementation SHOULD exit the process with a non-zero code (recommended: `process.exit(0)`)
 * - Alternatively, the implementation MAY throw a `CancelError` or similar
 * - The implementation MUST restore terminal state before exiting or throwing
 *
 * ### Error Handling
 *
 * - Terminal I/O errors SHOULD cause the promise to reject
 * - Invalid options (e.g., empty options array) SHOULD throw synchronously or reject
 * - Validation errors (for text input) MUST NOT reject; instead, re-prompt the user
 *
 * ### Concurrency
 *
 * - Only ONE prompt SHOULD be active at a time
 * - Calling a prompt method while another is active is undefined behavior
 * - Implementations MAY queue prompts or throw if concurrent calls are detected
 *
 * ### Non-Interactive Mode
 *
 * When stdin is not a TTY (non-interactive mode):
 * - Implementations SHOULD use `initialValue` if provided
 * - Implementations MAY throw an error indicating interactive input is required
 * - Implementations MUST NOT hang waiting for input that will never come
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
 *
 * @example Simple provider (no pagination)
 * ```typescript
 * const provider: OptionsProvider<string> = async () => {
 *   const items = await fetchItems();
 *   return { options: items.map(i => ({ value: i.id, label: i.name })) };
 * };
 * ```
 *
 * @example Paginated provider
 * ```typescript
 * const provider: OptionsProvider<string> = async ({ cursor }) => {
 *   const page = await api.list({ after: cursor, limit: 20 });
 *   return {
 *     options: page.items.map(i => ({ value: i.id, label: i.name })),
 *     nextCursor: page.nextCursor,
 *   };
 * };
 * ```
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
 *
 * @example
 * ```typescript
 * const provider = withCapabilities(
 *   async ({ filter }) => {
 *     const results = await api.search(filter);
 *     return { options: results };
 *   },
 *   { supportsFilter: true, filterDebounceMs: 200 }
 * );
 * ```
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
   *
   * ## Contract
   * - MUST be called on each input change or on submit
   * - If validation fails, the error message MUST be displayed to the user
   * - The prompt MUST NOT resolve until validation passes
   * - Validation SHOULD be synchronous
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

// =============================================================================
// Prompter Interface
// =============================================================================

/**
 * Prompter interface for interactive user input.
 *
 * ## Lifecycle Contract
 *
 * The Prompter is stateless between calls. Each method:
 * 1. Takes control of the terminal
 * 2. Displays a prompt and waits for input
 * 3. Returns the result and releases terminal control
 *
 * ## Error Categories
 *
 * | Error Type | Handling |
 * |------------|----------|
 * | User cancellation (Ctrl+C) | Exit process or throw CancelError |
 * | Invalid options | Throw synchronously |
 * | Terminal I/O error | Reject promise |
 * | Validation failure | Re-prompt (do not reject) |
 *
 * ## Implementation Checklist
 *
 * Implementations MUST:
 * - [ ] Handle Ctrl+C gracefully
 * - [ ] Restore terminal state on completion
 * - [ ] Support keyboard navigation
 * - [ ] Display clear visual feedback
 *
 * Implementations SHOULD:
 * - [ ] Support mouse input where applicable
 * - [ ] Handle terminal resize
 * - [ ] Provide accessible output
 */
export interface Prompter {
  /**
   * Display a selection prompt with multiple options.
   *
   * The user navigates with arrow keys and confirms with Enter.
   *
   * ## Contract
   * - MUST display all options from `options.options`
   * - MUST return the `value` of the selected option
   * - MUST highlight the currently focused option
   * - If `initialValue` is provided and found, MUST pre-select that option
   * - If `options.options` is empty, SHOULD throw an error
   *
   * ## Cancellation
   * - On Ctrl+C: Exit process or throw CancelError
   *
   * @template T - The type of values in the options
   * @param options - Configuration for the select prompt
   * @returns Promise resolving to the selected value
   *
   * @example
   * ```typescript
   * const color = await prompter.select({
   *   message: 'Pick a color',
   *   options: [
   *     { value: 'red', label: 'Red' },
   *     { value: 'blue', label: 'Blue' },
   *   ],
   * });
   * ```
   */
  select<T>(options: SelectOptions<T>): Promise<T>;

  /**
   * Display a multi-selection prompt allowing multiple choices.
   *
   * The user navigates with arrow keys, toggles with Space, and confirms with Enter.
   *
   * ## Contract
   * - MUST display all options from `options.options`
   * - MUST return an array of `value`s for all selected options
   * - MUST allow toggling individual options on/off
   * - If `initialValues` is provided, MUST pre-select matching options
   * - If `required` is true and no options are selected, MUST NOT resolve
   * - If `options.options` is empty, SHOULD throw an error
   *
   * ## Return Value
   * - Returns values in the order they appear in `options.options`, not selection order
   * - Returns empty array `[]` if nothing selected (unless `required: true`)
   *
   * ## Cancellation
   * - On Ctrl+C: Exit process or throw CancelError
   *
   * @template T - The type of values in the options
   * @param options - Configuration for the multiselect prompt
   * @returns Promise resolving to array of selected values
   *
   * @example
   * ```typescript
   * const toppings = await prompter.multiselect({
   *   message: 'Select toppings',
   *   options: [
   *     { value: 'cheese', label: 'Cheese' },
   *     { value: 'pepperoni', label: 'Pepperoni' },
   *     { value: 'mushrooms', label: 'Mushrooms' },
   *   ],
   *   required: true,
   * });
   * ```
   */
  multiselect<T>(options: MultiselectOptions<T>): Promise<T[]>;

  /**
   * Display a confirmation prompt (yes/no).
   *
   * The user selects yes or no and confirms with Enter.
   *
   * ## Contract
   * - MUST display a yes/no choice
   * - MUST return `true` for yes, `false` for no
   * - If `initialValue` is provided, MUST pre-select that choice
   * - Default selection (when no `initialValue`) SHOULD be `false` (no)
   *
   * ## Cancellation
   * - On Ctrl+C: Exit process or throw CancelError
   *
   * @param options - Configuration for the confirm prompt
   * @returns Promise resolving to boolean (true = yes, false = no)
   *
   * @example
   * ```typescript
   * const shouldContinue = await prompter.confirm({
   *   message: 'Do you want to continue?',
   *   initialValue: true,
   * });
   * ```
   */
  confirm(options: ConfirmOptions): Promise<boolean>;

  /**
   * Display a text input prompt.
   *
   * The user types text and confirms with Enter.
   *
   * ## Contract
   * - MUST display an input field for text entry
   * - MUST return the entered text as a string
   * - If `initialValue` is provided, MUST pre-fill the input
   * - If `placeholder` is provided, MUST display it when input is empty
   * - If `validate` is provided, MUST call it before resolving
   *
   * ## Validation Contract
   * - If `validate` returns a string, display it as an error and re-prompt
   * - If `validate` returns `undefined`, the input is valid
   * - The promise MUST NOT resolve until validation passes
   *
   * ## Empty Input
   * - Empty string `""` is a valid return value unless `validate` rejects it
   *
   * ## Cancellation
   * - On Ctrl+C: Exit process or throw CancelError
   *
   * @param options - Configuration for the text prompt
   * @returns Promise resolving to the entered text
   *
   * @example
   * ```typescript
   * const name = await prompter.text({
   *   message: 'What is your name?',
   *   placeholder: 'Enter your name',
   *   validate: (value) => {
   *     if (value.length < 2) return 'Name must be at least 2 characters';
   *     return undefined;
   *   },
   * });
   * ```
   */
  text(options: TextOptions): Promise<string>;
}
