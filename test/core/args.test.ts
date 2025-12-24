import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  parseContext,
  resolveInteractiveContext,
  validateRequiredContext,
  extractChoices,
} from '../../packages/core/src/lib/args';
import type { ContextDef, Prompter } from '@openpok/core';

// =============================================================================
// Test Fixtures
// =============================================================================

const simpleContextDef = {
  env: {
    from: 'flag' as const,
    schema: z.enum(['dev', 'staging', 'prod']),
    description: 'Environment to deploy to',
  },
  verbose: {
    from: 'flag' as const,
    schema: z.boolean().default(false),
    description: 'Enable verbose output',
  },
  tag: {
    from: 'flag' as const,
    schema: z.string().optional(),
    description: 'Optional tag',
  },
} satisfies ContextDef;

const requiredStringContextDef = {
  name: {
    from: 'flag' as const,
    schema: z.string(),
    description: 'Required name',
  },
} satisfies ContextDef;

// =============================================================================
// parseContext Tests
// =============================================================================

describe('parseContext', () => {
  describe('basic flag parsing', () => {
    it('parses --flag value format for strings', () => {
      const { context, rest } = parseContext(['--env', 'staging'], simpleContextDef);
      expect(context.env).toBe('staging');
      expect(rest).toEqual([]);
    });

    it('parses --flag value format for enums', () => {
      const { context } = parseContext(['--env', 'prod'], simpleContextDef);
      expect(context.env).toBe('prod');
    });

    it('handles multiple flags', () => {
      const { context } = parseContext(
        ['--env', 'dev', '--verbose', '--tag', 'v1.0'],
        simpleContextDef
      );
      expect(context.env).toBe('dev');
      expect(context.verbose).toBe(true);
      expect(context.tag).toBe('v1.0');
    });
  });

  describe('boolean flags', () => {
    it('sets boolean to true with --flag', () => {
      const { context } = parseContext(['--verbose'], simpleContextDef);
      expect(context.verbose).toBe(true);
    });

    it('sets boolean to false with --no-flag', () => {
      const { context } = parseContext(['--no-verbose'], simpleContextDef);
      expect(context.verbose).toBe(false);
    });

    it('defaults boolean to false when not provided', () => {
      const { context } = parseContext(['--env', 'dev'], simpleContextDef);
      expect(context.verbose).toBe(false);
    });
  });

  describe('kebab-case conversion', () => {
    const kebabContextDef = {
      dryRun: {
        from: 'flag' as const,
        schema: z.boolean().default(false),
        description: 'Dry run mode',
      },
      noGitChecks: {
        from: 'flag' as const,
        schema: z.boolean().default(false),
        description: 'Skip git checks',
      },
    } satisfies ContextDef;

    it('converts --dry-run to dryRun', () => {
      const { context } = parseContext(['--dry-run'], kebabContextDef);
      expect(context.dryRun).toBe(true);
    });

    it('converts --no-no-git-checks to noGitChecks (negated boolean)', () => {
      // --no-<flag> negates a boolean flag
      // So --no-no-git-checks negates noGitChecks (sets it to false)
      const { context } = parseContext(['--no-no-git-checks'], kebabContextDef);
      expect(context.noGitChecks).toBe(false);
    });

    it('converts --noGitChecks to set it true', () => {
      const { context } = parseContext(['--noGitChecks'], kebabContextDef);
      expect(context.noGitChecks).toBe(true);
    });

    it('also accepts camelCase directly', () => {
      const { context } = parseContext(['--dryRun'], kebabContextDef);
      expect(context.dryRun).toBe(true);
    });
  });

  describe('positional arguments', () => {
    it('collects positional arguments in rest', () => {
      const { context, rest } = parseContext(
        ['--env', 'dev', 'file1.ts', 'file2.ts'],
        simpleContextDef
      );
      expect(context.env).toBe('dev');
      expect(rest).toEqual(['file1.ts', 'file2.ts']);
    });

    it('handles positional args before flags', () => {
      const { rest } = parseContext(['file1.ts', '--env', 'dev'], simpleContextDef);
      expect(rest).toEqual(['file1.ts']);
    });

    it('handles mixed positional and flags', () => {
      const { context, rest } = parseContext(
        ['file1.ts', '--verbose', 'file2.ts', '--env', 'staging'],
        simpleContextDef
      );
      expect(context.verbose).toBe(true);
      expect(context.env).toBe('staging');
      expect(rest).toEqual(['file1.ts', 'file2.ts']);
    });
  });

  describe('error handling', () => {
    it('throws for unknown flags', () => {
      expect(() => parseContext(['--unknown'], simpleContextDef)).toThrow('Unknown flag: --unknown');
    });

    it('throws when string flag has no value', () => {
      expect(() => parseContext(['--env'], simpleContextDef)).toThrow(
        'Flag --env requires a value'
      );
    });

    it('throws when flag value is another flag', () => {
      expect(() => parseContext(['--env', '--verbose'], simpleContextDef)).toThrow(
        'Flag --env requires a value'
      );
    });

    it('throws for invalid enum value', () => {
      expect(() => parseContext(['--env', 'invalid'], simpleContextDef)).toThrow(
        'Invalid value for --env: invalid'
      );
    });
  });

  describe('defaults', () => {
    it('applies schema defaults', () => {
      const { context } = parseContext([], simpleContextDef);
      expect(context.verbose).toBe(false);
    });

    it('overrides defaults with explicit flags', () => {
      const { context } = parseContext(['--verbose'], simpleContextDef);
      expect(context.verbose).toBe(true);
    });
  });
});

// =============================================================================
// resolveInteractiveContext Tests
// =============================================================================

describe('resolveInteractiveContext', () => {
  // Mock prompter for testing
  function createMockPrompter(responses: {
    select?: unknown[];
    confirm?: boolean[];
    text?: string[];
  }): Prompter {
    let selectIdx = 0;
    let confirmIdx = 0;
    let textIdx = 0;

    return {
      async select<T>(): Promise<T> {
        return (responses.select?.[selectIdx++] ?? 'dev') as T;
      },
      async multiselect<T>(): Promise<T[]> {
        return [] as T[];
      },
      async confirm(): Promise<boolean> {
        return responses.confirm?.[confirmIdx++] ?? false;
      },
      async text(): Promise<string> {
        return responses.text?.[textIdx++] ?? '';
      },
    };
  }

  describe('fromMenu=true (prompt for all fields)', () => {
    it('prompts for enum field with select', async () => {
      const prompter = createMockPrompter({ select: ['staging'] });
      const context = { env: undefined, verbose: false, tag: undefined } as any;
      const choices = new Map([['env', ['dev', 'staging', 'prod']]]);

      const result = await resolveInteractiveContext(
        context,
        simpleContextDef,
        choices,
        prompter,
        true
      );

      expect(result.env).toBe('staging');
    });

    it('prompts for boolean field with confirm', async () => {
      const prompter = createMockPrompter({ select: ['dev'], confirm: [true] });
      const context = { env: undefined, verbose: false, tag: undefined } as any;
      const choices = new Map([['env', ['dev', 'staging', 'prod']]]);

      const result = await resolveInteractiveContext(
        context,
        simpleContextDef,
        choices,
        prompter,
        true
      );

      expect(result.verbose).toBe(true);
    });

    it('prompts for string field with text', async () => {
      const prompter = createMockPrompter({
        select: ['dev'],
        confirm: [false],
        text: ['my-tag'],
      });
      const context = { env: undefined, verbose: false, tag: undefined } as any;
      const choices = new Map([['env', ['dev', 'staging', 'prod']]]);

      const result = await resolveInteractiveContext(
        context,
        simpleContextDef,
        choices,
        prompter,
        true
      );

      expect(result.tag).toBe('my-tag');
    });
  });

  describe('fromMenu=false (prompt only for missing required)', () => {
    it('does not prompt for optional fields', async () => {
      const prompter = createMockPrompter({ text: ['should-not-be-called'] });
      const context = { env: 'dev', verbose: false, tag: undefined } as any;
      const choices = new Map<string, string[]>();

      const result = await resolveInteractiveContext(
        context,
        simpleContextDef,
        choices,
        prompter,
        false
      );

      // tag is optional, should remain undefined
      expect(result.tag).toBeUndefined();
    });

    it('prompts for missing required fields', async () => {
      const prompter = createMockPrompter({ text: ['test-name'] });
      const context = { name: undefined } as any;
      const choices = new Map<string, string[]>();

      const result = await resolveInteractiveContext(
        context,
        requiredStringContextDef,
        choices,
        prompter,
        false
      );

      expect(result.name).toBe('test-name');
    });

    it('does not prompt when required field is already set', async () => {
      const prompter = createMockPrompter({ text: ['should-not-be-called'] });
      const context = { name: 'existing' } as any;
      const choices = new Map<string, string[]>();

      const result = await resolveInteractiveContext(
        context,
        requiredStringContextDef,
        choices,
        prompter,
        false
      );

      expect(result.name).toBe('existing');
    });
  });
});

// =============================================================================
// validateRequiredContext Tests
// =============================================================================

describe('validateRequiredContext', () => {
  it('passes when all required fields are present', () => {
    const context = { name: 'test' } as any;
    expect(() => validateRequiredContext(context, requiredStringContextDef)).not.toThrow();
  });

  it('throws when required field is undefined', () => {
    const context = { name: undefined } as any;
    expect(() => validateRequiredContext(context, requiredStringContextDef)).toThrow(
      'Required flag --name is missing'
    );
  });

  it('throws when required field is empty string', () => {
    const context = { name: '' } as any;
    expect(() => validateRequiredContext(context, requiredStringContextDef)).toThrow(
      'Required flag --name is missing'
    );
  });

  it('does not throw for missing optional fields', () => {
    const context = { env: 'dev', verbose: false, tag: undefined } as any;
    expect(() => validateRequiredContext(context, simpleContextDef)).not.toThrow();
  });
});

// =============================================================================
// extractChoices Tests
// =============================================================================

describe('extractChoices', () => {
  it('extracts enum choices from schema', () => {
    const choices = extractChoices(simpleContextDef);
    const envChoices = choices.get('env');

    // The function uses heuristics, so we check if known values are detected
    expect(envChoices).toBeDefined();
    expect(envChoices).toContain('dev');
    expect(envChoices).toContain('staging');
    expect(envChoices).toContain('prod');
  });

  it('does not extract choices for boolean fields', () => {
    const choices = extractChoices(simpleContextDef);
    expect(choices.get('verbose')).toBeUndefined();
  });

  it('does not extract choices for string fields', () => {
    const choices = extractChoices(simpleContextDef);
    expect(choices.get('tag')).toBeUndefined();
  });

  it('returns empty map for context without enums', () => {
    const noEnumContext = {
      name: { from: 'flag' as const, schema: z.string(), description: 'Name' },
      enabled: { from: 'flag' as const, schema: z.boolean(), description: 'Enabled' },
    } satisfies ContextDef;

    const choices = extractChoices(noEnumContext);
    expect(choices.size).toBe(0);
  });
});
