/**
 * Tests for dynamic options (lazy loading) in prompter
 */

import { describe, it, expect } from 'bun:test';
import {
  createRawPrompter,
  isDynamicOptions,
  type SelectOptions,
  type StaticSelectOptions,
  type DynamicSelectOptions,
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
      provider: async () => [{ value: 'a', label: 'A' }],
    };

    expect(isDynamicOptions(dynamicOpts)).toBe(true);
  });

  it('works with SelectOptions union type', () => {
    const opts: SelectOptions<string> = {
      message: 'Pick one',
      provider: async () => [],
    };

    if (isDynamicOptions(opts)) {
      // TypeScript should narrow to DynamicSelectOptions
      expect(opts.provider).toBeDefined();
    }
  });
});

// =============================================================================
// Provider Contract Tests
// =============================================================================

describe('OptionsProvider contract', () => {
  it('receives the filter and signal arguments', async () => {
    let receivedFilter: string | undefined = 'unset';
    let receivedSignal: AbortSignal | undefined;

    const provider: DynamicSelectOptions<string>['provider'] = async (filter, signal) => {
      receivedFilter = filter;
      receivedSignal = signal;
      return [{ value: filter ?? 'default', label: 'Label' }];
    };

    const controller = new AbortController();
    const result = await provider('test', controller.signal);

    expect(receivedFilter).toBe('test');
    expect(receivedSignal).toBe(controller.signal);
    expect(result).toEqual([{ value: 'test', label: 'Label' }]);
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
      provider: async () => [
        { value: 'first', label: 'First' },
        { value: 'second', label: 'Second' },
      ],
    });

    expect(result).toBe('first');
  });

  it('resolves provider and uses configured response', async () => {
    const prompter = createRawPrompter({
      selectResponses: ['selected-value'],
    });

    const result = await prompter.select({
      message: 'Select item',
      provider: async () => [
        { value: 'first', label: 'First' },
        { value: 'selected-value', label: 'Selected' },
      ],
    });

    expect(result).toBe('selected-value');
  });

  it('passes abort signal to provider', async () => {
    let receivedSignal: AbortSignal | undefined;

    const prompter = createRawPrompter();

    await prompter.select({
      message: 'Select item',
      provider: async (_filter, signal) => {
        receivedSignal = signal;
        return [{ value: 'a', label: 'A' }];
      },
    });

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal!.aborted).toBe(false);
  });

  it('uses initialValue from dynamic options when available', async () => {
    const prompter = createRawPrompter();

    const result = await prompter.select({
      message: 'Select item',
      provider: async () => [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      initialValue: 'b',
    });

    // Raw prompter defaults to initialValue when no response is configured
    expect(result).toBe('b');
  });

  it('records dynamic options call correctly', async () => {
    const prompter = createRawPrompter();

    await prompter.select({
      message: 'Select item',
      provider: async () => [{ value: 'a', label: 'A' }],
    });

    const calls = prompter.getCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('select');
    expect('provider' in (calls[0].options as any)).toBe(true);
  });
});

// =============================================================================
// Backwards Compatibility Tests
// =============================================================================

describe('static options', () => {
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
      provider: async () => [],
    };

    // Runtime check
    expect('options' in staticOpts).toBe(true);
    expect('provider' in dynamicOpts).toBe(true);
  });
});
