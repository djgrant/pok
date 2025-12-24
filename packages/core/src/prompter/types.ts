/**
 * Prompter Interface
 *
 * Defines the contract for interactive user input adapters.
 * This is the "input" side of the CLI - blocking calls that wait for user response.
 *
 * Implementations: @openpok/prompter-clack
 */

// =============================================================================
// Option Types
// =============================================================================

export type SelectOption<T> = {
  value: T;
  label: string;
  hint?: string;
};

export type SelectOptions<T> = {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
};

export type ConfirmOptions = {
  message: string;
  initialValue?: boolean;
};

export type TextOptions = {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
};

export type MultiselectOption<T> = {
  value: T;
  label: string;
  hint?: string;
};

export type MultiselectOptions<T> = {
  message: string;
  options: MultiselectOption<T>[];
  initialValues?: T[];
  required?: boolean;
};

// =============================================================================
// Prompter Interface
// =============================================================================

export interface Prompter {
  /**
   * Display a selection prompt with multiple options.
   * Returns the selected value.
   *
   * If the user cancels (e.g., Ctrl+C), the implementation should handle it
   * appropriately (e.g., exit the process or throw).
   */
  select<T>(options: SelectOptions<T>): Promise<T>;

  /**
   * Display a multi-selection prompt allowing multiple choices.
   * Returns an array of selected values.
   *
   * If the user cancels (e.g., Ctrl+C), the implementation should handle it
   * appropriately (e.g., exit the process or throw).
   */
  multiselect<T>(options: MultiselectOptions<T>): Promise<T[]>;

  /**
   * Display a confirmation prompt (yes/no).
   * Returns true for yes, false for no.
   *
   * If the user cancels (e.g., Ctrl+C), the implementation should handle it
   * appropriately (e.g., exit the process or throw).
   */
  confirm(options: ConfirmOptions): Promise<boolean>;

  /**
   * Display a text input prompt.
   * Returns the entered text.
   *
   * If the user cancels (e.g., Ctrl+C), the implementation should handle it
   * appropriately (e.g., exit the process or throw).
   */
  text(options: TextOptions): Promise<string>;
}
