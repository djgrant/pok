/**
 * Terminal Prompter Implementation
 *
 * Implements the Prompter interface using the owned prompt engine
 * (./engine). Dynamic selects route loading through the shared terminal
 * Screen, keeping a single screen owner; filtering is handled client-side by
 * the autocomplete prompt once options are loaded.
 */

import pc from 'picocolors';
import type {
  Prompter,
  SelectOptions,
  SelectOption,
  DynamicSelectOptions,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
  AutocompleteOptions,
} from '@pokit/core';
import { isDynamicOptions, CancelError } from '@pokit/core';
import {
  CANCEL,
  SelectPrompt,
  MultiselectPrompt,
  ConfirmPrompt,
  TextPrompt,
  AutocompletePrompt,
} from './engine';
import type { Screen } from '../screen.js';

/** Unwrap a prompt result, throwing CancelError on cancel. */
function unwrap<T>(result: T | typeof CANCEL): T {
  if (result === CANCEL) {
    throw new CancelError('Cancelled');
  }
  return result;
}

// =============================================================================
// Dynamic Select Implementation
// =============================================================================

type ErrorAction = 'retry' | 'cancel';

/**
 * Show error recovery prompt. Returns 'retry' or 'cancel'.
 */
async function showErrorRecovery(errorMessage: string): Promise<ErrorAction> {
  const result = await new SelectPrompt<ErrorAction>({
    message: `Error: ${errorMessage}`,
    options: [
      { value: 'retry', label: 'Retry', hint: 'Try loading again' },
      { value: 'cancel', label: 'Cancel', hint: 'Abort selection' },
    ],
  }).prompt();
  return result === CANCEL ? 'cancel' : result;
}

/**
 * Handle a dynamic select: load the option set via the provider (loading shown
 * through the shared screen), then present them with type-ahead filtering.
 */
async function handleDynamicSelect<T>(
  dynamicOptions: DynamicSelectOptions<T>,
  screen: Screen
): Promise<T> {
  const loadingMessage = dynamicOptions.loadingMessage ?? 'Loading...';

  let options: SelectOption<T>[];
  try {
    options = await screen.withLoading(loadingMessage, (signal) =>
      dynamicOptions.provider(undefined, signal)
    );
  } catch (error) {
    const errorMessage =
      dynamicOptions.errorMessage ??
      (error instanceof Error ? error.message : 'Failed to load options');

    const action = await showErrorRecovery(errorMessage);
    if (action === 'cancel') {
      throw new CancelError('Cancelled');
    }
    return handleDynamicSelect(dynamicOptions, screen);
  }

  if (options.length === 0) {
    process.stdout.write(`${pc.red('■')}  No options available\n`);
    throw new CancelError('No options available');
  }

  const result = await new AutocompletePrompt<T>({
    message: dynamicOptions.message,
    options,
    initialValue: dynamicOptions.initialValue,
  }).prompt();

  return unwrap(result);
}

// =============================================================================
// Main Prompter Factory
// =============================================================================

/**
 * Create a Prompter using the owned prompt engine, sharing the terminal Screen.
 */
export function createPrompter(screen: Screen): Prompter {
  return {
    async select<T>(options: SelectOptions<T>): Promise<T> {
      if (isDynamicOptions(options)) {
        return handleDynamicSelect(options, screen);
      }

      const result = await new SelectPrompt<T>({
        message: options.message,
        options: options.options,
        initialValue: options.initialValue,
      }).prompt();

      return unwrap(result);
    },

    async multiselect<T>(options: MultiselectOptions<T>): Promise<T[]> {
      const result = await new MultiselectPrompt<T>({
        message: options.message,
        options: options.options,
        initialValues: options.initialValues,
        required: options.required,
      }).prompt();

      return unwrap(result);
    },

    async confirm(options: ConfirmOptions): Promise<boolean> {
      const result = await new ConfirmPrompt({
        message: options.message,
        initialValue: options.initialValue,
      }).prompt();

      return unwrap(result);
    },

    async text(options: TextOptions): Promise<string> {
      const result = await new TextPrompt({
        message: options.message,
        placeholder: options.placeholder,
        initialValue: options.initialValue,
        validate: options.validate,
      }).prompt();

      return unwrap(result);
    },

    async autocomplete<T>(options: AutocompleteOptions<T>): Promise<T> {
      const result = await new AutocompletePrompt<T>({
        message: options.message,
        options: options.options,
        placeholder: options.placeholder,
        maxItems: options.maxItems,
      }).prompt();

      return unwrap(result);
    },
  };
}
