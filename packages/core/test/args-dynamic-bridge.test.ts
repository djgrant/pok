import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { resolveInteractiveContext } from '../src/lib/args';
import { createRawPrompter, isDynamicOptions } from '../src';
import type { PromptCall } from '../src';

/**
 * Coverage for the "dynamic provider bridge" in args.ts: a context field's
 * resolve() may return a plain array, a paginated { options, nextCursor } page,
 * or an async iterator of pages. All three are collapsed into a single flat
 * prompter OptionsProvider `(filter, signal) => Promise<SelectOption[]>`.
 *
 * The bridge functions are private, so we drive them through the public
 * resolveInteractiveContext() path and inspect the dynamic provider handed to
 * the prompter's select().
 */

/** Build a one-field context def whose resolve() we control. */
function contextDefWith(resolve: NonNullable<Parameters<typeof buildField>[0]>) {
  return { id: buildField(resolve) };
}

function buildField(
  resolve: (request: { cursor?: string; filter?: string; signal: AbortSignal }, context: Record<string, unknown>) => unknown
) {
  return {
    from: 'flag' as const,
    schema: z.string(),
    description: 'id',
    resolve: resolve as never,
  };
}

/**
 * Run resolveInteractiveContext with a raw prompter, then pull out the dynamic
 * provider from the recorded select call and resolve its full option list.
 */
async function loadProviderValues(
  resolve: Parameters<typeof buildField>[0],
  selectResponse: unknown = undefined
): Promise<{ values: unknown[]; selected: unknown }> {
  const calls: PromptCall[] = [];
  const prompter = createRawPrompter({
    selectResponses: selectResponse === undefined ? undefined : [selectResponse],
    onPrompt: (call) => calls.push(call),
  });

  const result = await resolveInteractiveContext(
    { id: undefined } as never,
    contextDefWith(resolve) as never,
    new Map(),
    prompter,
    /* fromMenu */ true
  );

  const selectCall = calls.find((c) => c.type === 'select' && isDynamicOptions(c.options));
  expect(selectCall).toBeDefined();

  const dynamic = selectCall!.options as {
    provider: (filter: string | undefined, signal: AbortSignal) => Promise<{ value: unknown }[]>;
  };
  const options = await dynamic.provider(undefined, new AbortController().signal);
  return { values: options.map((o) => o.value), selected: (result as Record<string, unknown>).id };
}

describe('dynamic resolve provider bridge', () => {
  it('bridges a plain array of primitives', async () => {
    const { values, selected } = await loadProviderValues(() => ['a', 'b', 'c']);
    expect(values).toEqual(['a', 'b', 'c']);
    // Raw prompter default picks the first option.
    expect(selected).toBe('a');
  });

  it('bridges { value, label } option objects', async () => {
    const { values } = await loadProviderValues(() => [
      { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' },
    ]);
    expect(values).toEqual(['x', 'y']);
  });

  it('follows nextCursor across paginated pages', async () => {
    const pages: Record<string, { options: string[]; nextCursor?: string }> = {
      '': { options: ['p1a', 'p1b'], nextCursor: 'c1' },
      c1: { options: ['p2a'], nextCursor: 'c2' },
      c2: { options: ['p3a'] },
    };
    const { values } = await loadProviderValues((req) => pages[req.cursor ?? '']);
    expect(values).toEqual(['p1a', 'p1b', 'p2a', 'p3a']);
  });

  it('flattens an async iterator of pages', async () => {
    async function* gen() {
      yield ['i1', 'i2'];
      yield { options: ['i3'] };
      yield ['i4'];
    }
    const { values } = await loadProviderValues(() => gen());
    expect(values).toEqual(['i1', 'i2', 'i3', 'i4']);
  });

  it('throws on a repeated cursor (pagination loop guard)', async () => {
    // Always returns the same nextCursor -> infinite loop unless guarded.
    const loop = () => ({ options: ['z'], nextCursor: 'same' });
    await expect(loadProviderValues(loop)).rejects.toThrow(/repeated cursor/);
  });
});
