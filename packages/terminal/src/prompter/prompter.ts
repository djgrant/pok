/**
 * Clack Prompter Implementation
 *
 * Implements the Prompter interface using @clack/prompts.
 *
 * Dynamic selects no longer spawn their own spinners: loading is routed through
 * the shared terminal Screen, keeping a single screen owner. Filtering is
 * handled client-side by the autocomplete prompt once options are loaded.
 */

import * as p from '@clack/prompts';
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
import { patchedAutocomplete } from './autocomplete-prompt.js';
import type { Screen } from '../screen.js';

// =============================================================================
// Error Recovery
// =============================================================================

type ErrorAction = 'retry' | 'cancel';

/**
 * Show error recovery prompt. Returns 'retry' or 'cancel'.
 */
async function showErrorRecovery(errorMessage: string): Promise<ErrorAction> {
  const result = await p.select({
    message: `Error: ${errorMessage}`,
    options: [
      { value: 'retry' as const, label: 'Retry', hint: 'Try loading again' },
      { value: 'cancel' as const, label: 'Cancel', hint: 'Abort selection' },
    ],
  });

  if (p.isCancel(result)) {
    return 'cancel';
  }

  return result as ErrorAction;
}

// =============================================================================
// Dynamic Select Implementation
// =============================================================================

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
      p.cancel('Cancelled');
      throw new CancelError('Cancelled');
    }
    // Retry
    return handleDynamicSelect(dynamicOptions, screen);
  }

  if (options.length === 0) {
    p.cancel('No options available');
    throw new CancelError('No options available');
  }

  const result = await patchedAutocomplete({
    message: dynamicOptions.message,
    options: options.map((opt) => ({
      value: opt.value,
      label: opt.label,
      hint: opt.hint,
    })),
  });

  if (p.isCancel(result)) {
    throw new CancelError('Cancelled');
  }

  return result as T;
}

// =============================================================================
// Grouped Options Helpers
// =============================================================================

/**
 * Organize flat options into a group → options record for clack's groupMultiselect.
 * Options without a group are placed under an empty-string key.
 */
function toGroupedRecord<T>(
  options: { value: T; label: string; hint?: string; group?: string }[]
): Record<string, { value: T; label: string; hint?: string }[]> {
  const groups: Record<string, { value: T; label: string; hint?: string }[]> = {};
  for (const opt of options) {
    const key = opt.group ?? '';
    if (!groups[key]) groups[key] = [];
    groups[key]!.push({ value: opt.value, label: opt.label, hint: opt.hint });
  }
  return groups;
}

/**
 * Sort options by group order (preserving insertion order of first occurrence)
 * and add group name as label prefix for visual separation in a flat select.
 */
function flattenGroupedForSelect<T>(
  options: { value: T; label: string; hint?: string; group?: string }[]
): { value: T; label: string; hint?: string }[] {
  const groupOrder: string[] = [];
  for (const opt of options) {
    const key = opt.group ?? '';
    if (!groupOrder.includes(key)) groupOrder.push(key);
  }

  const result: { value: T; label: string; hint?: string }[] = [];
  for (const group of groupOrder) {
    const groupOpts = options.filter((opt) => (opt.group ?? '') === group);
    for (const opt of groupOpts) {
      result.push({
        value: opt.value,
        label: group ? `${group} › ${opt.label}` : opt.label,
        hint: opt.hint,
      });
    }
  }
  return result;
}

// =============================================================================
// Main Prompter Factory
// =============================================================================

/**
 * Create a Prompter using @clack/prompts, sharing the terminal Screen.
 */
export function createPrompter(screen: Screen): Prompter {
  return {
    async select<T>(options: SelectOptions<T>): Promise<T> {
      // Handle dynamic options via the shared screen
      if (isDynamicOptions(options)) {
        return handleDynamicSelect(options, screen);
      }

      // Static options - handle grouped or flat
      const opts = options.options;
      const clackOptions = opts.some((o) => o.group)
        ? flattenGroupedForSelect(opts)
        : opts.map((opt) => ({ value: opt.value, label: opt.label, hint: opt.hint }));

      const result = await p.select({
        message: options.message,
        options: clackOptions as Parameters<typeof p.select<T>>[0]['options'],
        initialValue: options.initialValue,
      });

      if (p.isCancel(result)) {
        throw new CancelError('Cancelled');
      }

      return result as T;
    },

    async multiselect<T>(options: MultiselectOptions<T>): Promise<T[]> {
      // Use groupMultiselect when options have groups
      const msOpts = options.options;
      if (msOpts.some((o) => o.group)) {
        const grouped = toGroupedRecord(msOpts);
        const result = await p.groupMultiselect({
          message: options.message,
          options: grouped as any,
          required: options.required,
        });

        if (p.isCancel(result)) {
          throw new CancelError('Cancelled');
        }

        return result as T[];
      }

      const result = await p.multiselect({
        message: options.message,
        options: options.options as Parameters<typeof p.multiselect<T>>[0]['options'],
        initialValues: options.initialValues,
        required: options.required,
      });

      if (p.isCancel(result)) {
        throw new CancelError('Cancelled');
      }

      return result as T[];
    },

    async confirm(options: ConfirmOptions): Promise<boolean> {
      const result = await p.confirm({
        message: options.message,
        initialValue: options.initialValue,
      });

      if (p.isCancel(result)) {
        throw new CancelError('Cancelled');
      }

      return result;
    },

    async text(options: TextOptions): Promise<string> {
      const result = await p.text({
        message: options.message,
        placeholder: options.placeholder,
        initialValue: options.initialValue,
        validate: options.validate
          ? (value: string | undefined) => options.validate!(value ?? '')
          : undefined,
      });

      if (p.isCancel(result)) {
        throw new CancelError('Cancelled');
      }

      return result;
    },

    async autocomplete<T>(options: AutocompleteOptions<T>): Promise<T> {
      const result = await patchedAutocomplete({
        message: options.message,
        options: options.options.map((opt) => ({
          value: opt.value,
          label: opt.label,
          hint: opt.hint,
        })),
        placeholder: options.placeholder,
        maxItems: options.maxItems,
      });

      if (p.isCancel(result)) {
        throw new CancelError('Cancelled');
      }

      return result as T;
    },
  };
}
