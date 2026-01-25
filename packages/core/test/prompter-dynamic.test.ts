/**
 * Tests for dynamic options (lazy loading) in prompter
 */

import { describe, it, expect } from 'bun:test';
import {
  createRawPrompter,
  isDynamicOptions,
  withCapabilities,
  type SelectOptions,
  type StaticSelectOptions,
  type DynamicSelectOptions,
  type OptionsProvider,
  type OptionsPage,
  type OptionsRequest,
} from '../src';

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('isDynamicOptions', () => {
  it('returns false for static options', () => {
    const staticOpts: StaticSelectOptions<string> = {
      message: 'Pick one',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };

    expect(isDynamicOptions(staticOpts)).toBe(false);
  });

  it('returns true for dynamic options', () => {
    const dynamicOpts: DynamicSelectOptions<string> = {
      message: 'Pick one',
      provider: async () => ({
        options: [{ value: 'a', label: 'A' }],
      }),
    };

    expect(isDynamicOptions(dynamicOpts)).toBe(true);
  });

  it('works with SelectOptions union type', () => {
    const opts: SelectOptions<string> = {
      message: 'Pick one',
      provider: async () => ({ options: [] }),
    };

    if (isDynamicOptions(opts)) {
      // TypeScript should narrow to DynamicSelectOptions
      expect(opts.provider).toBeDefined();
    }
  });
});

// =============================================================================
// withCapabilities Helper Tests
// =============================================================================

describe('withCapabilities', () => {
  it('attaches capabilities to provider function', () => {
    const provider = withCapabilities(async () => ({ options: [{ value: 'a', label: 'A' }] }), {
      supportsFilter: true,
      filterDebounceMs: 200,
    });

    expect(provider.capabilities).toEqual({
      supportsFilter: true,
      filterDebounceMs: 200,
    });
  });

  it('provider remains callable after adding capabilities', async () => {
    const provider = withCapabilities(
      async ({ filter }) => ({
        options: [{ value: filter ?? 'default', label: 'Label' }],
      }),
      { supportsFilter: true }
    );

    const controller = new AbortController();
    const result = await provider({ signal: controller.signal, filter: 'test' });

    expect(result.options).toEqual([{ value: 'test', label: 'Label' }]);
  });
});

// =============================================================================
// Raw Prompter with Dynamic Options Tests
// =============================================================================

describe('createRawPrompter with dynamic options', () => {
  it('resolves provider and uses default (first option)', async () => {
    const prompter = createRawPrompter();

    const result = await prompter.select({
      message: 'Select item',
      provider: async () => ({
        options: [
          { value: 'first', label: 'First' },
          { value: 'second', label: 'Second' },
        ],
      }),
    });

    expect(result).toBe('first');
  });

  it('resolves provider and uses configured response', async () => {
    const prompter = createRawPrompter({
      selectResponses: ['selected-value'],
    });

    const result = await prompter.select({
      message: 'Select item',
      provider: async () => ({
        options: [
          { value: 'first', label: 'First' },
          { value: 'selected-value', label: 'Selected' },
        ],
      }),
    });

    expect(result).toBe('selected-value');
  });

  it('handles provider with pagination info', async () => {
    const prompter = createRawPrompter();

    const result = await prompter.select({
      message: 'Select item',
      provider: async () => ({
        options: [{ value: 'item', label: 'Item' }],
        nextCursor: 'page-2',
        totalCount: 100,
      }),
    });

    expect(result).toBe('item');
  });

  it('passes abort signal to provider', async () => {
    let receivedSignal: AbortSignal | undefined;

    const prompter = createRawPrompter();

    await prompter.select({
      message: 'Select item',
      provider: async ({ signal }) => {
        receivedSignal = signal;
        return { options: [{ value: 'a', label: 'A' }] };
      },
    });

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal!.aborted).toBe(false);
  });

  it('uses initialValue from dynamic options when available', async () => {
    const prompter = createRawPrompter();

    const result = await prompter.select({
      message: 'Select item',
      provider: async () => ({
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
      initialValue: 'b',
    });

    // Raw prompter defaults to initialValue when no response is configured
    expect(result).toBe('b');
  });

  it('records dynamic options call correctly', async () => {
    const prompter = createRawPrompter();

    await prompter.select({
      message: 'Select item',
      provider: async () => ({
        options: [{ value: 'a', label: 'A' }],
      }),
    });

    const calls = prompter.getCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('select');
    expect('provider' in (calls[0].options as any)).toBe(true);
  });
});

// =============================================================================
// Provider Type Tests
// =============================================================================

describe('OptionsProvider type', () => {
  it('allows simple provider without pagination', async () => {
    const provider: OptionsProvider<string> = async () => ({
      options: [{ value: 'a', label: 'A' }],
    });

    const controller = new AbortController();
    const result = await provider({ signal: controller.signal });

    expect(result.options).toHaveLength(1);
    expect(result.nextCursor).toBeUndefined();
  });

  it('allows paginated provider with cursor', async () => {
    const pages: Record<string, OptionsPage<string>> = {
      initial: {
        options: [{ value: 'a', label: 'A' }],
        nextCursor: 'page-2',
        totalCount: 3,
      },
      'page-2': {
        options: [{ value: 'b', label: 'B' }],
        nextCursor: 'page-3',
      },
      'page-3': {
        options: [{ value: 'c', label: 'C' }],
        // No nextCursor = last page
      },
    };

    const provider: OptionsProvider<string> = async ({ cursor }) => {
      return pages[cursor ?? 'initial'];
    };

    const controller = new AbortController();

    // First page
    const page1 = await provider({ signal: controller.signal });
    expect(page1.options[0].value).toBe('a');
    expect(page1.nextCursor).toBe('page-2');
    expect(page1.totalCount).toBe(3);

    // Second page
    const page2 = await provider({ signal: controller.signal, cursor: 'page-2' });
    expect(page2.options[0].value).toBe('b');
    expect(page2.nextCursor).toBe('page-3');

    // Last page
    const page3 = await provider({ signal: controller.signal, cursor: 'page-3' });
    expect(page3.options[0].value).toBe('c');
    expect(page3.nextCursor).toBeUndefined();
  });

  it('allows provider with filter support', async () => {
    const allItems = [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
      { value: 'cherry', label: 'Cherry' },
    ];

    const provider = withCapabilities(
      async ({ filter }) => {
        const filtered = filter
          ? allItems.filter((i) => i.label.toLowerCase().includes(filter.toLowerCase()))
          : allItems;
        return { options: filtered };
      },
      { supportsFilter: true, filterDebounceMs: 100 }
    );

    const controller = new AbortController();

    // No filter
    const all = await provider({ signal: controller.signal });
    expect(all.options).toHaveLength(3);

    // With filter
    const filtered = await provider({ signal: controller.signal, filter: 'an' });
    expect(filtered.options).toHaveLength(1); // only banana contains 'an'
    expect(filtered.options.map((o) => o.value)).toContain('banana');
  });
});

// =============================================================================
// Backwards Compatibility Tests
// =============================================================================

describe('backwards compatibility', () => {
  it('static options work unchanged', async () => {
    const prompter = createRawPrompter({
      selectResponses: ['blue'],
    });

    const result = await prompter.select({
      message: 'Pick a color',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
        { value: 'green', label: 'Green' },
      ],
    });

    expect(result).toBe('blue');
  });

  it('static options with initialValue work unchanged', async () => {
    const prompter = createRawPrompter();

    const result = await prompter.select({
      message: 'Pick a color',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
      initialValue: 'blue',
    });

    // Raw prompter uses initialValue as default when no response configured
    expect(result).toBe('blue');
  });

  it('SelectOptions type accepts both static and dynamic', () => {
    // These should all type-check correctly
    const staticOpts: SelectOptions<string> = {
      message: 'Pick one',
      options: [{ value: 'a', label: 'A' }],
    };

    const dynamicOpts: SelectOptions<string> = {
      message: 'Pick one',
      provider: async () => ({ options: [] }),
    };

    // Runtime check
    expect('options' in staticOpts).toBe(true);
    expect('provider' in dynamicOpts).toBe(true);
  });
});

// =============================================================================
// Pagination Pattern Tests
// =============================================================================

describe('pagination patterns', () => {
  it('provider can return nextCursor for pagination', async () => {
    let page = 1;
    const provider: OptionsProvider<string> = async ({ cursor }) => {
      if (cursor === 'page-2') page = 2;
      if (cursor === 'page-3') page = 3;

      return {
        options: [{ value: `item-${page}`, label: `Item ${page}` }],
        nextCursor: page < 3 ? `page-${page + 1}` : undefined,
        totalCount: 3,
      };
    };

    const controller = new AbortController();

    // Page 1
    const result1 = await provider({ signal: controller.signal });
    expect(result1.options[0].value).toBe('item-1');
    expect(result1.nextCursor).toBe('page-2');

    // Page 2
    const result2 = await provider({ signal: controller.signal, cursor: 'page-2' });
    expect(result2.options[0].value).toBe('item-2');
    expect(result2.nextCursor).toBe('page-3');

    // Page 3 (last)
    const result3 = await provider({ signal: controller.signal, cursor: 'page-3' });
    expect(result3.options[0].value).toBe('item-3');
    expect(result3.nextCursor).toBeUndefined();
  });

  it('totalCount enables progress display', async () => {
    const provider: OptionsProvider<string> = async () => ({
      options: Array.from({ length: 10 }, (_, i) => ({
        value: `item-${i}`,
        label: `Item ${i}`,
      })),
      nextCursor: 'more',
      totalCount: 100,
    });

    const controller = new AbortController();
    const result = await provider({ signal: controller.signal });

    // Can display "10 of 100"
    expect(result.options).toHaveLength(10);
    expect(result.totalCount).toBe(100);
  });

  it('accumulated options simulation', async () => {
    // Simulates what a pagination UI would do
    const provider: OptionsProvider<string> = async ({ cursor }) => {
      const pageNum = cursor ? parseInt(cursor.split('-')[1]) : 1;
      const items = Array.from({ length: 5 }, (_, i) => ({
        value: `item-${(pageNum - 1) * 5 + i + 1}`,
        label: `Item ${(pageNum - 1) * 5 + i + 1}`,
      }));

      return {
        options: items,
        nextCursor: pageNum < 4 ? `page-${pageNum + 1}` : undefined,
        totalCount: 20,
      };
    };

    const controller = new AbortController();

    // Accumulate all pages
    const accumulated: typeof provider extends OptionsProvider<infer T>
      ? { value: T; label: string }[]
      : never = [];
    let cursor: string | undefined;

    do {
      const page = await provider({ signal: controller.signal, cursor });
      accumulated.push(...page.options);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(accumulated).toHaveLength(20);
    expect(accumulated[0].value).toBe('item-1');
    expect(accumulated[19].value).toBe('item-20');
  });
});

// =============================================================================
// Typeahead/Filter Tests
// =============================================================================

describe('typeahead filtering', () => {
  it('provider receives filter parameter', async () => {
    let receivedFilter: string | undefined;

    const provider = withCapabilities(
      async ({ filter }) => {
        receivedFilter = filter;
        return { options: [{ value: 'a', label: 'A' }] };
      },
      { supportsFilter: true }
    );

    const controller = new AbortController();
    await provider({ signal: controller.signal, filter: 'test-query' });

    expect(receivedFilter).toBe('test-query');
  });

  it('server-side filtering returns filtered results', async () => {
    const allItems = [
      { value: 'apple', label: 'Apple' },
      { value: 'apricot', label: 'Apricot' },
      { value: 'banana', label: 'Banana' },
      { value: 'cherry', label: 'Cherry' },
    ];

    const provider = withCapabilities(
      async ({ filter }) => ({
        options: filter
          ? allItems.filter((i) => i.label.toLowerCase().startsWith(filter.toLowerCase()))
          : allItems,
      }),
      { supportsFilter: true }
    );

    const controller = new AbortController();

    // Filter by 'ap'
    const result = await provider({ signal: controller.signal, filter: 'ap' });
    expect(result.options).toHaveLength(2);
    expect(result.options.map((o) => o.value)).toEqual(['apple', 'apricot']);
  });

  it('filterDebounceMs is configurable', () => {
    const provider = withCapabilities(async () => ({ options: [] }), {
      supportsFilter: true,
      filterDebounceMs: 300,
    });

    expect(provider.capabilities?.filterDebounceMs).toBe(300);
  });
});

// =============================================================================
// Error Recovery Tests
// =============================================================================

describe('error recovery patterns', () => {
  it('provider throws errors for error recovery', async () => {
    const provider: OptionsProvider<string> = async () => {
      throw new Error('Network timeout');
    };

    const controller = new AbortController();
    await expect(provider({ signal: controller.signal })).rejects.toThrow('Network timeout');
  });

  it('recoverable provider succeeds on retry', async () => {
    let attempts = 0;

    const provider: OptionsProvider<string> = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return { options: [{ value: 'success', label: 'Success!' }] };
    };

    const controller = new AbortController();

    // First two attempts fail
    await expect(provider({ signal: controller.signal })).rejects.toThrow('Attempt 1 failed');
    await expect(provider({ signal: controller.signal })).rejects.toThrow('Attempt 2 failed');

    // Third succeeds
    const result = await provider({ signal: controller.signal });
    expect(result.options[0].value).toBe('success');
    expect(attempts).toBe(3);
  });

  it('AbortError is distinct from other errors', async () => {
    const provider: OptionsProvider<string> = async ({ signal }) => {
      if (signal.aborted) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      return { options: [{ value: 'a', label: 'A' }] };
    };

    const controller = new AbortController();
    controller.abort();

    try {
      await provider({ signal: controller.signal });
      expect(true).toBe(false); // Should not reach
    } catch (error) {
      expect((error as Error).name).toBe('AbortError');
    }
  });
});

// =============================================================================
// Progressive Loading Tests
// =============================================================================

describe('progressive loading', () => {
  it('provider resolves promptly for immediate display', async () => {
    const startTime = Date.now();

    const provider: OptionsProvider<string> = async () => {
      // Simulate fast response
      return { options: [{ value: 'fast', label: 'Fast Response' }] };
    };

    const controller = new AbortController();
    const result = await provider({ signal: controller.signal });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(100);
    expect(result.options).toHaveLength(1);
  });

  it('signal.aborted can be checked during long operations', async () => {
    const provider: OptionsProvider<string> = async ({ signal }) => {
      // Check abort before expensive operation
      if (signal.aborted) {
        throw new Error('Aborted before processing');
      }

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check again after processing
      if (signal.aborted) {
        throw new Error('Aborted after processing');
      }

      return { options: [{ value: 'done', label: 'Done' }] };
    };

    const controller = new AbortController();

    // Normal execution
    const result = await provider({ signal: controller.signal });
    expect(result.options[0].value).toBe('done');
  });
});
