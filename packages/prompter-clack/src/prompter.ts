/**
 * Clack Prompter Implementation
 *
 * Implements the Prompter interface using @clack/prompts.
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
  OptionsPage,
} from '@pokit/core';
import { isDynamicOptions } from '@pokit/core';
import { patchedAutocomplete } from './autocomplete-prompt.js';

// =============================================================================
// Constants
// =============================================================================

/** Symbol value for the "Load more" option */
const LOAD_MORE_SYMBOL = Symbol('__pok_load_more__');

/** Default debounce time for filter requests */
const DEFAULT_FILTER_DEBOUNCE_MS = 150;

// =============================================================================
// Types
// =============================================================================

/** Internal state for dynamic select */
type DynamicSelectState<T> = {
  /** All loaded options so far */
  options: SelectOption<T>[];
  /** Cursor for next page (null if no more pages) */
  nextCursor: string | null;
  /** Total count if known */
  totalCount?: number;
  /** Current filter string */
  filter?: string;
  /** Whether we're currently loading */
  isLoading: boolean;
  /** Last error if any */
  error?: Error;
};

/** Error recovery action */
type ErrorAction = 'retry' | 'cancel';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates a debounced version of a function
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Client-side filter for options
 */
function filterOptionsClientSide<T>(options: SelectOption<T>[], filter: string): SelectOption<T>[] {
  const lowerFilter = filter.toLowerCase();
  return options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(lowerFilter) ||
      (opt.hint && opt.hint.toLowerCase().includes(lowerFilter))
  );
}

/**
 * Format progress text (e.g., "10 of 50")
 */
function formatProgress(loaded: number, total?: number): string {
  if (total !== undefined) {
    return `${loaded} of ${total}`;
  }
  return `${loaded} loaded`;
}

// =============================================================================
// Error Recovery
// =============================================================================

/**
 * Show error recovery prompt
 * Returns 'retry' or 'cancel'
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
 * Handle dynamic select with pagination, filtering, and error recovery
 */
async function handleDynamicSelect<T>(dynamicOptions: DynamicSelectOptions<T>): Promise<T> {
  const controller = new AbortController();
  const provider = dynamicOptions.provider;
  const capabilities = provider.capabilities;
  const supportsFilter = capabilities?.supportsFilter ?? false;
  const filterDebounceMs = capabilities?.filterDebounceMs ?? DEFAULT_FILTER_DEBOUNCE_MS;

  // State
  const state: DynamicSelectState<T> = {
    options: [],
    nextCursor: null,
    isLoading: true,
    filter: undefined,
  };

  // Load options from provider
  async function loadOptions(
    cursor?: string,
    filter?: string,
    append = false
  ): Promise<OptionsPage<T>> {
    const result = await provider({
      cursor,
      filter,
      signal: controller.signal,
    });
    return result;
  }

  // Initial load with spinner
  const loadingMessage = dynamicOptions.loadingMessage ?? 'Loading...';
  const spinner = p.spinner();
  spinner.start(loadingMessage);

  try {
    const initialPage = await loadOptions();
    state.options = initialPage.options;
    state.nextCursor = initialPage.nextCursor ?? null;
    state.totalCount = initialPage.totalCount;
    state.isLoading = false;
    spinner.stop(loadingMessage);
  } catch (error) {
    spinner.stop('Failed to load options');
    const errorMessage =
      dynamicOptions.errorMessage ??
      (error instanceof Error ? error.message : 'Failed to load options');

    // Show error recovery
    const action = await showErrorRecovery(errorMessage);
    if (action === 'cancel') {
      p.cancel('Cancelled');
      process.exit(0);
    }

    // Retry - recursive call
    return handleDynamicSelect(dynamicOptions);
  }

  // Check for empty results
  if (state.options.length === 0) {
    p.cancel('No options available');
    process.exit(0);
  }

  // Main selection loop - handles "Load more" and re-selection
  while (true) {
    // Build options list
    const displayOptions: { value: T | typeof LOAD_MORE_SYMBOL; label: string; hint?: string }[] =
      [];

    // Determine which options to show (filter if needed)
    let optionsToShow = state.options;
    if (state.filter && !supportsFilter) {
      // Client-side filtering
      optionsToShow = filterOptionsClientSide(state.options, state.filter);
    }

    // Add user options
    for (const opt of optionsToShow) {
      displayOptions.push({
        value: opt.value,
        label: opt.label,
        hint: opt.hint,
      });
    }

    // Add "Load more" if there are more pages
    if (state.nextCursor) {
      const loadMoreLabel = dynamicOptions.loadMoreLabel ?? 'Load more...';
      const progress = formatProgress(state.options.length, state.totalCount);
      displayOptions.push({
        value: LOAD_MORE_SYMBOL,
        label: loadMoreLabel,
        hint: progress,
      });
    }

    // Handle case where filtering removed all visible options
    if (displayOptions.length === 0) {
      p.cancel('No matching options');
      process.exit(0);
    }

    // Show the select prompt
    const result = await p.select({
      message: dynamicOptions.message,
      options: displayOptions as Parameters<typeof p.select>[0]['options'],
      initialValue: dynamicOptions.initialValue,
    });

    if (p.isCancel(result)) {
      controller.abort();
      process.exit(0);
    }

    // Check if "Load more" was selected
    if (result === LOAD_MORE_SYMBOL) {
      // Load more options
      const loadMoreSpinner = p.spinner();
      loadMoreSpinner.start('Loading more...');

      try {
        const nextPage = await loadOptions(state.nextCursor ?? undefined);

        // Append new options
        state.options = [...state.options, ...nextPage.options];
        state.nextCursor = nextPage.nextCursor ?? null;
        // Keep totalCount from initial if not provided in subsequent pages
        if (nextPage.totalCount !== undefined) {
          state.totalCount = nextPage.totalCount;
        }

        loadMoreSpinner.stop(
          `Loaded ${state.options.length}${state.totalCount ? ` of ${state.totalCount}` : ''}`
        );

        // Continue the loop to show updated options
        continue;
      } catch (error) {
        loadMoreSpinner.stop('Failed to load more');
        const errorMessage = error instanceof Error ? error.message : 'Failed to load more options';

        // Show error recovery
        const action = await showErrorRecovery(errorMessage);
        if (action === 'cancel') {
          p.cancel('Cancelled');
          process.exit(0);
        }

        // Retry loading more - continue the loop
        continue;
      }
    }

    // User selected an actual option
    return result as T;
  }
}

/**
 * Handle dynamic select with typeahead filtering
 * This creates a text input that filters options as you type
 */
async function handleDynamicSelectWithTypeahead<T>(
  dynamicOptions: DynamicSelectOptions<T>
): Promise<T> {
  const controller = new AbortController();
  const provider = dynamicOptions.provider;
  const capabilities = provider.capabilities;
  const supportsServerFilter = capabilities?.supportsFilter ?? false;
  const filterDebounceMs = capabilities?.filterDebounceMs ?? DEFAULT_FILTER_DEBOUNCE_MS;

  // State
  let allOptions: SelectOption<T>[] = [];
  let nextCursor: string | null = null;
  let totalCount: number | undefined;
  let currentFilter = '';

  // Load with optional filter
  async function loadOptions(cursor?: string, filter?: string): Promise<OptionsPage<T>> {
    return provider({
      cursor,
      filter: supportsServerFilter ? filter : undefined,
      signal: controller.signal,
    });
  }

  // Initial load
  const loadingMessage = dynamicOptions.loadingMessage ?? 'Loading...';
  const spinner = p.spinner();
  spinner.start(loadingMessage);

  try {
    const initialPage = await loadOptions();
    allOptions = initialPage.options;
    nextCursor = initialPage.nextCursor ?? null;
    totalCount = initialPage.totalCount;
    spinner.stop(loadingMessage);
  } catch (error) {
    spinner.stop('Failed to load options');
    const errorMessage =
      dynamicOptions.errorMessage ??
      (error instanceof Error ? error.message : 'Failed to load options');

    const action = await showErrorRecovery(errorMessage);
    if (action === 'cancel') {
      p.cancel('Cancelled');
      process.exit(0);
    }
    return handleDynamicSelectWithTypeahead(dynamicOptions);
  }

  if (allOptions.length === 0) {
    p.cancel('No options available');
    process.exit(0);
  }

  // For server-side filtering, we need to refetch when filter changes
  // For client-side filtering, we just filter the loaded options
  // Since @clack/prompts doesn't have a built-in typeahead, we use the standard select
  // The filtering is done before each render

  // Main selection loop
  while (true) {
    // Apply filter
    let displayOptions = allOptions;
    if (currentFilter && !supportsServerFilter) {
      displayOptions = filterOptionsClientSide(allOptions, currentFilter);
    }

    // Build the options array
    const selectOptions: { value: T | typeof LOAD_MORE_SYMBOL; label: string; hint?: string }[] =
      displayOptions.map((opt) => ({
        value: opt.value,
        label: opt.label,
        hint: opt.hint,
      }));

    // Add load more if available
    if (nextCursor) {
      const loadMoreLabel = dynamicOptions.loadMoreLabel ?? 'Load more...';
      const progress = formatProgress(allOptions.length, totalCount);
      selectOptions.push({
        value: LOAD_MORE_SYMBOL,
        label: loadMoreLabel,
        hint: progress,
      });
    }

    if (selectOptions.length === 0) {
      p.cancel('No matching options');
      process.exit(0);
    }

    const result = await p.select({
      message: dynamicOptions.message,
      options: selectOptions as Parameters<typeof p.select>[0]['options'],
      initialValue: dynamicOptions.initialValue,
    });

    if (p.isCancel(result)) {
      controller.abort();
      process.exit(0);
    }

    if (result === LOAD_MORE_SYMBOL) {
      const loadMoreSpinner = p.spinner();
      loadMoreSpinner.start('Loading more...');

      try {
        const nextPage = await loadOptions(nextCursor ?? undefined, currentFilter);
        allOptions = [...allOptions, ...nextPage.options];
        nextCursor = nextPage.nextCursor ?? null;
        if (nextPage.totalCount !== undefined) {
          totalCount = nextPage.totalCount;
        }
        loadMoreSpinner.stop(`Loaded ${allOptions.length}${totalCount ? ` of ${totalCount}` : ''}`);
        continue;
      } catch (error) {
        loadMoreSpinner.stop('Failed to load more');
        const errorMessage = error instanceof Error ? error.message : 'Failed to load more';
        const action = await showErrorRecovery(errorMessage);
        if (action === 'cancel') {
          p.cancel('Cancelled');
          process.exit(0);
        }
        continue;
      }
    }

    return result as T;
  }
}

// =============================================================================
// Main Prompter Factory
// =============================================================================

/**
 * Create a Prompter using @clack/prompts
 */
export function createPrompter(): Prompter {
  return {
    async select<T>(options: SelectOptions<T>): Promise<T> {
      // Handle dynamic options
      if (isDynamicOptions(options)) {
        const supportsFilter = options.provider.capabilities?.supportsFilter ?? false;

        // Use typeahead handler if filtering is supported
        if (supportsFilter) {
          return handleDynamicSelectWithTypeahead(options);
        }

        // Standard dynamic select with pagination
        return handleDynamicSelect(options);
      }

      // Static options - existing behavior
      const result = await p.select({
        message: options.message,
        options: options.options as Parameters<typeof p.select<T>>[0]['options'],
        initialValue: options.initialValue,
      });

      if (p.isCancel(result)) {
        process.exit(0);
      }

      return result as T;
    },

    async multiselect<T>(options: MultiselectOptions<T>): Promise<T[]> {
      const result = await p.multiselect({
        message: options.message,
        options: options.options as Parameters<typeof p.multiselect<T>>[0]['options'],
        initialValues: options.initialValues,
        required: options.required,
      });

      if (p.isCancel(result)) {
        process.exit(0);
      }

      return result as T[];
    },

    async confirm(options: ConfirmOptions): Promise<boolean> {
      const result = await p.confirm({
        message: options.message,
        initialValue: options.initialValue,
      });

      if (p.isCancel(result)) {
        process.exit(0);
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
        process.exit(0);
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
        process.exit(0);
      }

      return result as T;
    },
  };
}
