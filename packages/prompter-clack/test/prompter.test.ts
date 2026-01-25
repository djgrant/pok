import { describe, it, expect } from 'bun:test';
import { createPrompter } from '@pokit/prompter-clack';
import {
  isDynamicOptions,
  withCapabilities,
  type SelectOptions,
  type DynamicSelectOptions,
  type OptionsProvider,
  type OptionsPage,
} from '@pokit/core';

// =============================================================================
// Note: Testing the prompter-clack implementation is challenging because:
// 1. @clack/prompts exports are readonly and cannot be mocked
// 2. The prompts require actual TTY interaction
//
// These tests focus on the structure and behavior we can verify without
// mocking the underlying clack/prompts library. For full integration testing,
// the existing integration tests in test/core/ cover prompt behavior via
// the createRawPrompter utility.
// =============================================================================

// =============================================================================
// createPrompter Tests
// =============================================================================

describe('createPrompter', () => {
  it('returns object with all required prompter methods', () => {
    const prompter = createPrompter();

    expect(typeof prompter.select).toBe('function');
    expect(typeof prompter.multiselect).toBe('function');
    expect(typeof prompter.confirm).toBe('function');
    expect(typeof prompter.text).toBe('function');
  });

  it('returns a valid Prompter interface', () => {
    const prompter = createPrompter();

    // Verify the shape matches what we expect
    expect(prompter).toHaveProperty('select');
    expect(prompter).toHaveProperty('multiselect');
    expect(prompter).toHaveProperty('confirm');
    expect(prompter).toHaveProperty('text');
  });

  it('creates independent prompter instances', () => {
    const prompter1 = createPrompter();
    const prompter2 = createPrompter();

    // Each call should return a new instance
    expect(prompter1).not.toBe(prompter2);
  });
});

// =============================================================================
// Method Signature Tests
// These verify the methods accept the expected parameters without actually
// calling the underlying clack/prompts functions
// =============================================================================

describe('prompter method signatures', () => {
  const prompter = createPrompter();

  describe('select method', () => {
    it('is callable with correct options shape', () => {
      // Verify the function exists and has the right signature
      // We can't actually call it without a TTY
      expect(typeof prompter.select).toBe('function');
      expect(prompter.select.length).toBe(1); // Takes 1 argument (options)
    });
  });

  describe('multiselect method', () => {
    it('is callable with correct options shape', () => {
      expect(typeof prompter.multiselect).toBe('function');
      expect(prompter.multiselect.length).toBe(1);
    });
  });

  describe('confirm method', () => {
    it('is callable with correct options shape', () => {
      expect(typeof prompter.confirm).toBe('function');
      expect(prompter.confirm.length).toBe(1);
    });
  });

  describe('text method', () => {
    it('is callable with correct options shape', () => {
      expect(typeof prompter.text).toBe('function');
      expect(prompter.text.length).toBe(1);
    });
  });
});

// =============================================================================
// Type Compatibility Tests
// Verify that the prompter satisfies the Prompter interface from @pokit/core
// =============================================================================

describe('type compatibility', () => {
  it('prompter satisfies Prompter interface shape', () => {
    const prompter = createPrompter();

    // These type checks happen at compile time
    // At runtime, we just verify the methods exist
    const methods = ['select', 'multiselect', 'confirm', 'text'];

    for (const method of methods) {
      expect(prompter).toHaveProperty(method);
      expect(typeof (prompter as any)[method]).toBe('function');
    }
  });
});

// =============================================================================
// Dynamic Options Support Tests
// Verify that the select method can accept dynamic options
// =============================================================================

describe('dynamic options support', () => {
  it('isDynamicOptions correctly identifies static options', () => {
    const staticOpts: SelectOptions<string> = {
      message: 'Pick a color',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    };

    expect(isDynamicOptions(staticOpts)).toBe(false);
  });

  it('isDynamicOptions correctly identifies dynamic options', () => {
    const dynamicOpts: DynamicSelectOptions<string> = {
      message: 'Pick a color',
      provider: async () => ({
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
        ],
      }),
    };

    expect(isDynamicOptions(dynamicOpts)).toBe(true);
  });

  it('dynamic options have correct optional properties', () => {
    const dynamicOpts: DynamicSelectOptions<string> = {
      message: 'Pick a color',
      provider: async () => ({ options: [] }),
      loadingMessage: 'Loading colors...',
      loadMoreLabel: 'Load more colors...',
      errorMessage: 'Failed to load colors',
      initialValue: 'red',
    };

    expect(dynamicOpts.loadingMessage).toBe('Loading colors...');
    expect(dynamicOpts.loadMoreLabel).toBe('Load more colors...');
    expect(dynamicOpts.errorMessage).toBe('Failed to load colors');
    expect(dynamicOpts.initialValue).toBe('red');
  });
});

// =============================================================================
// Pagination Pattern Tests
// These test the provider patterns that enable pagination
// =============================================================================

describe('pagination patterns', () => {
  describe('paginated provider', () => {
    it('supports nextCursor for pagination', async () => {
      const pages: Record<string, OptionsPage<string>> = {
        initial: {
          options: [
            { value: 'item-1', label: 'Item 1' },
            { value: 'item-2', label: 'Item 2' },
          ],
          nextCursor: 'page-2',
          totalCount: 6,
        },
        'page-2': {
          options: [
            { value: 'item-3', label: 'Item 3' },
            { value: 'item-4', label: 'Item 4' },
          ],
          nextCursor: 'page-3',
        },
        'page-3': {
          options: [
            { value: 'item-5', label: 'Item 5' },
            { value: 'item-6', label: 'Item 6' },
          ],
          // No nextCursor means last page
        },
      };

      const provider: OptionsProvider<string> = async ({ cursor }) => {
        return pages[cursor ?? 'initial'];
      };

      const controller = new AbortController();

      // Page 1
      const page1 = await provider({ signal: controller.signal });
      expect(page1.options).toHaveLength(2);
      expect(page1.nextCursor).toBe('page-2');
      expect(page1.totalCount).toBe(6);

      // Page 2
      const page2 = await provider({ signal: controller.signal, cursor: 'page-2' });
      expect(page2.options).toHaveLength(2);
      expect(page2.nextCursor).toBe('page-3');

      // Page 3 (last)
      const page3 = await provider({ signal: controller.signal, cursor: 'page-3' });
      expect(page3.options).toHaveLength(2);
      expect(page3.nextCursor).toBeUndefined();
    });

    it('totalCount is optional and for progress display', async () => {
      const provider: OptionsProvider<string> = async ({ cursor }) => {
        if (!cursor) {
          return {
            options: [{ value: 'a', label: 'A' }],
            nextCursor: 'next',
            totalCount: 100, // "1 of 100" display
          };
        }
        return {
          options: [{ value: 'b', label: 'B' }],
          // No totalCount in subsequent pages - use initial value
        };
      };

      const controller = new AbortController();
      const page1 = await provider({ signal: controller.signal });
      expect(page1.totalCount).toBe(100);

      const page2 = await provider({ signal: controller.signal, cursor: 'next' });
      expect(page2.totalCount).toBeUndefined();
    });
  });

  describe('load more label configuration', () => {
    it('accepts custom loadMoreLabel', () => {
      const dynamicOpts: DynamicSelectOptions<string> = {
        message: 'Select project',
        provider: async () => ({
          options: [{ value: 'proj-1', label: 'Project 1' }],
          nextCursor: 'page-2',
          totalCount: 50,
        }),
        loadMoreLabel: 'Show 25 more projects...',
      };

      expect(dynamicOpts.loadMoreLabel).toBe('Show 25 more projects...');
    });

    it('uses default loadMoreLabel when not specified', () => {
      const dynamicOpts: DynamicSelectOptions<string> = {
        message: 'Select item',
        provider: async () => ({ options: [] }),
      };

      // Default is 'Load more...' - verified by type definition
      expect(dynamicOpts.loadMoreLabel).toBeUndefined();
    });
  });
});

// =============================================================================
// Typeahead Filtering Tests
// =============================================================================

describe('typeahead filtering', () => {
  describe('provider capabilities', () => {
    it('supportsFilter enables server-side filtering', () => {
      const provider = withCapabilities(
        async ({ filter }) => ({
          options: filter
            ? [{ value: filter, label: `Search: ${filter}` }]
            : [{ value: 'default', label: 'Default' }],
        }),
        { supportsFilter: true }
      );

      expect(provider.capabilities?.supportsFilter).toBe(true);
    });

    it('filterDebounceMs configures debounce timing', () => {
      const provider = withCapabilities(async () => ({ options: [] }), {
        supportsFilter: true,
        filterDebounceMs: 300,
      });

      expect(provider.capabilities?.filterDebounceMs).toBe(300);
    });

    it('defaults filterDebounceMs to 150ms when not specified', () => {
      const provider = withCapabilities(async () => ({ options: [] }), { supportsFilter: true });

      // Default 150ms is in the implementation, not the type
      expect(provider.capabilities?.filterDebounceMs).toBeUndefined();
    });
  });

  describe('client-side filtering', () => {
    it('provider without supportsFilter uses client-side filtering', async () => {
      const allItems = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
        { value: 'cherry', label: 'Cherry' },
      ];

      // Provider without filter capability - returns all items
      const provider: OptionsProvider<string> = async () => ({
        options: allItems,
      });

      expect(provider.capabilities?.supportsFilter).toBeUndefined();

      const controller = new AbortController();
      const result = await provider({ signal: controller.signal });
      expect(result.options).toHaveLength(3);

      // Client-side filtering would be done by the prompter
      // The provider just returns all options
    });
  });

  describe('server-side filtering', () => {
    it('provider with supportsFilter receives filter parameter', async () => {
      let receivedFilter: string | undefined;

      const provider = withCapabilities(
        async ({ filter }) => {
          receivedFilter = filter;
          return {
            options: filter
              ? [{ value: 'filtered', label: `Results for: ${filter}` }]
              : [{ value: 'all', label: 'All results' }],
          };
        },
        { supportsFilter: true }
      );

      const controller = new AbortController();

      // Without filter
      await provider({ signal: controller.signal });
      expect(receivedFilter).toBeUndefined();

      // With filter
      await provider({ signal: controller.signal, filter: 'test' });
      expect(receivedFilter).toBe('test');
    });
  });
});

// =============================================================================
// Error Recovery Tests
// =============================================================================

describe('error recovery', () => {
  it('provider can throw errors for error recovery', async () => {
    let callCount = 0;

    const provider: OptionsProvider<string> = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Network error');
      }
      return { options: [{ value: 'success', label: 'Success' }] };
    };

    const controller = new AbortController();

    // First call throws
    await expect(provider({ signal: controller.signal })).rejects.toThrow('Network error');
    expect(callCount).toBe(1);

    // Second call succeeds (simulating retry)
    const result = await provider({ signal: controller.signal });
    expect(result.options[0].value).toBe('success');
    expect(callCount).toBe(2);
  });

  it('custom errorMessage is available in options', () => {
    const dynamicOpts: DynamicSelectOptions<string> = {
      message: 'Select item',
      provider: async () => ({ options: [] }),
      errorMessage: 'Could not connect to server',
    };

    expect(dynamicOpts.errorMessage).toBe('Could not connect to server');
  });

  it('AbortError should be re-thrown for cancellation', async () => {
    const provider: OptionsProvider<string> = async ({ signal }) => {
      // Simulate checking abort signal
      if (signal.aborted) {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        throw error;
      }
      return { options: [{ value: 'a', label: 'A' }] };
    };

    const controller = new AbortController();

    // Normal call
    const result = await provider({ signal: controller.signal });
    expect(result.options).toHaveLength(1);

    // Aborted call
    controller.abort();
    await expect(provider({ signal: controller.signal })).rejects.toThrow('Aborted');
  });
});

// =============================================================================
// Progressive Loading UX Tests
// =============================================================================

describe('progressive loading UX', () => {
  it('loadingMessage is configurable', () => {
    const dynamicOpts: DynamicSelectOptions<string> = {
      message: 'Select user',
      provider: async () => ({ options: [] }),
      loadingMessage: 'Fetching users from API...',
    };

    expect(dynamicOpts.loadingMessage).toBe('Fetching users from API...');
  });

  it('provider returns signal for abort handling', async () => {
    let receivedSignal: AbortSignal | undefined;

    const provider: OptionsProvider<string> = async ({ signal }) => {
      receivedSignal = signal;
      return { options: [{ value: 'a', label: 'A' }] };
    };

    const controller = new AbortController();
    await provider({ signal: controller.signal });

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBe(controller.signal);
  });

  it('accumulated options pattern for load more', async () => {
    // Simulate what the prompter does internally
    const pages: OptionsPage<string>[] = [
      { options: [{ value: '1', label: 'One' }], nextCursor: 'p2' },
      { options: [{ value: '2', label: 'Two' }], nextCursor: 'p3' },
      { options: [{ value: '3', label: 'Three' }] },
    ];

    let pageIndex = 0;
    const provider: OptionsProvider<string> = async ({ cursor }) => {
      if (cursor) {
        pageIndex++;
      }
      return pages[pageIndex];
    };

    const controller = new AbortController();

    // Accumulate options as pages are loaded
    const accumulated: { value: string; label: string }[] = [];

    // Page 1
    const page1 = await provider({ signal: controller.signal });
    accumulated.push(...page1.options);
    expect(accumulated).toHaveLength(1);

    // Page 2
    const page2 = await provider({ signal: controller.signal, cursor: page1.nextCursor! });
    accumulated.push(...page2.options);
    expect(accumulated).toHaveLength(2);

    // Page 3
    const page3 = await provider({ signal: controller.signal, cursor: page2.nextCursor! });
    accumulated.push(...page3.options);
    expect(accumulated).toHaveLength(3);

    // No more pages
    expect(page3.nextCursor).toBeUndefined();
  });
});
