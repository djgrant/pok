import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  parseContext,
  resolveDynamicContext,
  resolveInteractiveContext,
  validateRequiredContext,
  extractChoices,
  extractEnumChoices,
  unwrapSchema,
} from '../src/lib/args';
import { CLIError } from '../src/lib/cli-error';
import type { ContextDef, Prompter } from '../src';

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

    it('preserves parsed schema output for coerced values', () => {
      const coerceContextDef = {
        count: {
          from: 'flag' as const,
          schema: z.coerce.number().int(),
          description: 'Count',
        },
      } satisfies ContextDef;

      const { context } = parseContext(['--count', '42'], coerceContextDef);
      expect(context.count).toBe(42);
      expect(typeof context.count).toBe('number');
    });

    it('preserves parsed schema output for transformed values', () => {
      const transformContextDef = {
        name: {
          from: 'flag' as const,
          schema: z.string().transform((v) => v.toUpperCase()),
          description: 'Name',
        },
      } satisfies ContextDef;

      const { context } = parseContext(['--name', 'alice'], transformContextDef);
      expect(context.name).toBe('ALICE');
    });
  });

  describe('--flag=value syntax', () => {
    it('parses --flag=value format for strings', () => {
      const { context, rest } = parseContext(['--env=staging'], simpleContextDef);
      expect(context.env).toBe('staging');
      expect(rest).toEqual([]);
    });

    it('parses --flag=value format for enums', () => {
      const { context } = parseContext(['--env=prod'], simpleContextDef);
      expect(context.env).toBe('prod');
    });

    it('handles empty value with --flag=', () => {
      const { context } = parseContext(['--tag='], simpleContextDef);
      expect(context.tag).toBe('');
    });

    it('handles value containing equals sign', () => {
      const { context } = parseContext(['--tag=a=b=c'], simpleContextDef);
      expect(context.tag).toBe('a=b=c');
    });

    it('handles mixed --flag=value and --flag value syntax', () => {
      const { context } = parseContext(
        ['--env=dev', '--verbose', '--tag', 'v1.0'],
        simpleContextDef
      );
      expect(context.env).toBe('dev');
      expect(context.verbose).toBe(true);
      expect(context.tag).toBe('v1.0');
    });

    it('throws for boolean flag with --flag=value syntax', () => {
      expect(() => parseContext(['--verbose=true'], simpleContextDef)).toThrow(
        'Boolean flag --verbose does not accept a value'
      );
    });

    it('throws for invalid enum value with --flag=value syntax', () => {
      expect(() => parseContext(['--env=invalid'], simpleContextDef)).toThrow(
        'Invalid value for --env: invalid'
      );
    });

    it('supports kebab-case with --flag=value syntax', () => {
      const kebabContextDef = {
        dryRun: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Dry run mode',
        },
      } satisfies ContextDef;
      const { context } = parseContext(['--dry-run=test'], kebabContextDef);
      expect(context.dryRun).toBe('test');
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
      expect(() => parseContext(['--unknown'], simpleContextDef)).toThrow(
        'Unknown flag: --unknown'
      );
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

  describe('typo suggestions', () => {
    it('suggests flag for single-character typo', () => {
      expect(() => parseContext(['--vebose'], simpleContextDef)).toThrow(
        /Did you mean --verbose\?/
      );
    });

    it('suggests flag for missing character', () => {
      expect(() => parseContext(['--verbos'], simpleContextDef)).toThrow(
        /Did you mean --verbose\?/
      );
    });

    it('suggests flag for extra character', () => {
      expect(() => parseContext(['--verboose'], simpleContextDef)).toThrow(
        /Did you mean --verbose\?/
      );
    });

    it('suggests flag for typo with kebab-case normalization', () => {
      const kebabContextDef = {
        dryRun: {
          from: 'flag' as const,
          schema: z.boolean().default(false),
          description: 'Dry run mode',
        },
      } satisfies ContextDef;
      // When user types --dryrun (missing hyphen), suggests one of the known forms
      // Both dryRun and dry-run are in knownFlags, so either could be suggested
      expect(() => parseContext(['--dryrun'], kebabContextDef)).toThrow(/Did you mean --dry/);
    });

    it('does not suggest for very distant strings', () => {
      try {
        parseContext(['--completely-unrelated-flag'], simpleContextDef);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Unknown flag: --completely-unrelated-flag');
        expect((error as Error).message).not.toContain('Did you mean');
      }
    });

    it('includes both error and suggestion in message', () => {
      try {
        parseContext(['--tg'], simpleContextDef);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Unknown flag: --tg');
        // 'tg' is distance 1 from 'tag', should suggest
        expect(message).toContain('Did you mean --tag?');
      }
    });

    it('suggests for short flags with small distance', () => {
      try {
        parseContext(['--en'], simpleContextDef);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Unknown flag: --en');
        // 'en' is distance 1 from 'env', should suggest
        expect(message).toContain('Did you mean --env?');
      }
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

  describe('error context (CLIError)', () => {
    it('throws CLIError when errorContext is provided', () => {
      const errorContext = {
        appName: 'mycli',
        commandPath: ['deploy'],
      };

      try {
        parseContext(['--unknown'], simpleContextDef, { errorContext });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        const cliError = error as CLIError;
        expect(cliError.context.appName).toBe('mycli');
        expect(cliError.context.commandPath).toEqual(['deploy']);
      }
    });

    it('CLIError format includes usage and help hint', () => {
      const errorContext = {
        appName: 'mycli',
        commandPath: ['deploy'],
      };

      try {
        parseContext(['--unknown'], simpleContextDef, { errorContext });
      } catch (error) {
        const cliError = error as CLIError;
        const formatted = cliError.format();
        expect(formatted).toContain('Error:');
        expect(formatted).toContain('Usage: mycli deploy');
        expect(formatted).toContain("Run 'mycli deploy --help' for more information.");
      }
    });

    it('throws regular Error when errorContext is not provided', () => {
      try {
        parseContext(['--unknown'], simpleContextDef);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(CLIError);
      }
    });
  });
});

// =============================================================================
// resolveDynamicContext Tests
// =============================================================================

describe('resolveDynamicContext', () => {
  it('resolves missing values from async resolver', async () => {
    const contextDef = {
      env: {
        from: 'flag' as const,
        schema: z.enum(['dev', 'staging', 'prod']),
        resolve: async () => 'staging',
      },
    } satisfies ContextDef;

    const parsed = parseContext([], contextDef);
    const resolved = await resolveDynamicContext(parsed.context, contextDef, {
      args: [],
      providedFlags: parsed.providedFlags,
    });

    expect(resolved.env).toBe('staging');
  });

  it('does not override explicit CLI values', async () => {
    const contextDef = {
      env: {
        from: 'flag' as const,
        schema: z.enum(['dev', 'staging', 'prod']),
        resolve: async () => 'staging',
      },
    } satisfies ContextDef;

    const parsed = parseContext(['--env', 'prod'], contextDef);
    const resolved = await resolveDynamicContext(parsed.context, contextDef, {
      args: ['--env', 'prod'],
      providedFlags: parsed.providedFlags,
    });

    expect(resolved.env).toBe('prod');
  });

  it('validates dynamic values through schema', async () => {
    const contextDef = {
      env: {
        from: 'flag' as const,
        schema: z.enum(['dev', 'staging', 'prod']),
        resolve: async () => 'invalid',
      },
    } satisfies ContextDef;

    const parsed = parseContext([], contextDef);
    await expect(
      resolveDynamicContext(parsed.context, contextDef, {
        args: [],
        providedFlags: parsed.providedFlags,
      })
    ).rejects.toThrow('Invalid dynamic value for --env: invalid');
  });

  it('keeps existing value when resolver returns undefined', async () => {
    const contextDef = {
      env: {
        from: 'flag' as const,
        schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
        resolve: async () => undefined,
      },
    } satisfies ContextDef;

    const parsed = parseContext([], contextDef);
    const resolved = await resolveDynamicContext(parsed.context, contextDef, {
      args: [],
      providedFlags: parsed.providedFlags,
    });

    expect(resolved.env).toBe('dev');
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

    // The function now extracts exact enum values
    expect(envChoices).toBeDefined();
    expect(envChoices).toEqual(['dev', 'staging', 'prod']);
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

  it('uses explicit choices when provided', () => {
    const contextDef = {
      mode: {
        from: 'flag' as const,
        schema: z.string(),
        choices: ['custom', 'values'],
        description: 'Mode selection',
      },
    } satisfies ContextDef;

    const choices = extractChoices(contextDef);
    expect(choices.get('mode')).toEqual(['custom', 'values']);
  });

  it('prefers explicit choices over schema extraction', () => {
    const contextDef = {
      mode: {
        from: 'flag' as const,
        schema: z.enum(['a', 'b', 'c']),
        choices: ['override', 'values'],
        description: 'Mode selection',
      },
    } satisfies ContextDef;

    const choices = extractChoices(contextDef);
    expect(choices.get('mode')).toEqual(['override', 'values']);
  });
});

// =============================================================================
// extractEnumChoices Tests (WP-004: Improved Enum Value Extraction)
// =============================================================================

describe('extractEnumChoices', () => {
  describe('basic enum extraction', () => {
    it('extracts choices from z.enum', () => {
      const choices = extractEnumChoices(z.enum(['alpha', 'beta', 'gamma']));
      expect(choices).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('extracts choices from custom enums (not just common values)', () => {
      const choices = extractEnumChoices(z.enum(['custom1', 'custom2', 'custom3']));
      expect(choices).toEqual(['custom1', 'custom2', 'custom3']);
    });

    it('extracts choices from single-value enum', () => {
      const choices = extractEnumChoices(z.enum(['only']));
      expect(choices).toEqual(['only']);
    });
  });

  describe('wrapped enum extraction', () => {
    it('extracts through optional wrapper', () => {
      const choices = extractEnumChoices(z.enum(['a', 'b']).optional());
      expect(choices).toEqual(['a', 'b']);
    });

    it('extracts through default wrapper', () => {
      const choices = extractEnumChoices(z.enum(['x', 'y', 'z']).default('x'));
      expect(choices).toEqual(['x', 'y', 'z']);
    });

    it('extracts through nullable wrapper', () => {
      const choices = extractEnumChoices(z.enum(['foo', 'bar']).nullable());
      expect(choices).toEqual(['foo', 'bar']);
    });

    it('extracts through multiple wrappers', () => {
      const choices = extractEnumChoices(z.enum(['one', 'two']).optional().default('one'));
      expect(choices).toEqual(['one', 'two']);
    });

    it('extracts through nested wrappers (optional -> nullable)', () => {
      const choices = extractEnumChoices(z.enum(['p', 'q']).optional().nullable());
      expect(choices).toEqual(['p', 'q']);
    });
  });

  describe('native enum extraction', () => {
    it('extracts from native enum', () => {
      enum Mode {
        Dev = 'dev',
        Prod = 'prod',
      }
      const choices = extractEnumChoices(z.nativeEnum(Mode));
      expect(choices).toEqual(['dev', 'prod']);
    });

    it('extracts from native enum with more values', () => {
      enum Status {
        Pending = 'pending',
        Active = 'active',
        Completed = 'completed',
        Archived = 'archived',
      }
      const choices = extractEnumChoices(z.nativeEnum(Status));
      expect(choices).toEqual(['pending', 'active', 'completed', 'archived']);
    });

    it('extracts from wrapped native enum', () => {
      enum Level {
        Low = 'low',
        High = 'high',
      }
      const choices = extractEnumChoices(z.nativeEnum(Level).optional());
      expect(choices).toEqual(['low', 'high']);
    });
  });

  describe('union of literals extraction', () => {
    it('extracts from union of two literals', () => {
      const schema = z.literal('a').or(z.literal('b'));
      const choices = extractEnumChoices(schema);
      expect(choices).toEqual(['a', 'b']);
    });

    it('extracts from union of multiple literals', () => {
      const schema = z.literal('x').or(z.literal('y')).or(z.literal('z'));
      const choices = extractEnumChoices(schema);
      expect(choices).toEqual(['x', 'y', 'z']);
    });

    it('extracts from z.union with literal array', () => {
      const schema = z.union([z.literal('first'), z.literal('second'), z.literal('third')]);
      const choices = extractEnumChoices(schema);
      expect(choices).toEqual(['first', 'second', 'third']);
    });

    it('returns undefined for mixed union (not all string literals)', () => {
      const schema = z.union([z.literal('a'), z.literal(123)]);
      const choices = extractEnumChoices(schema);
      expect(choices).toBeUndefined();
    });

    it('returns undefined for union with non-literal types', () => {
      const schema = z.union([z.literal('a'), z.string()]);
      const choices = extractEnumChoices(schema);
      expect(choices).toBeUndefined();
    });
  });

  describe('non-enum schemas', () => {
    it('returns undefined for plain string', () => {
      const choices = extractEnumChoices(z.string());
      expect(choices).toBeUndefined();
    });

    it('returns undefined for boolean', () => {
      const choices = extractEnumChoices(z.boolean());
      expect(choices).toBeUndefined();
    });

    it('returns undefined for number', () => {
      const choices = extractEnumChoices(z.number());
      expect(choices).toBeUndefined();
    });

    it('returns undefined for object', () => {
      const choices = extractEnumChoices(z.object({ name: z.string() }));
      expect(choices).toBeUndefined();
    });

    it('returns undefined for array', () => {
      const choices = extractEnumChoices(z.array(z.string()));
      expect(choices).toBeUndefined();
    });

    it('returns undefined for string with refinement', () => {
      const choices = extractEnumChoices(z.string().refine((v) => ['a', 'b'].includes(v)));
      expect(choices).toBeUndefined();
    });
  });
});

// =============================================================================
// unwrapSchema Tests
// =============================================================================

// Helper to get type name from schema (works with both Zod v3 and v4)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTypeName(schema: any): string {
  // Zod v3 uses typeName, Zod v4 uses type
  return schema._def?.typeName || schema._def?.type || 'unknown';
}

describe('unwrapSchema', () => {
  it('returns the schema as-is when no wrapper', () => {
    const schema = z.string();
    const unwrapped = unwrapSchema(schema);
    const typeName = getTypeName(unwrapped);
    expect(typeName === 'ZodString' || typeName === 'string').toBe(true);
  });

  it('unwraps optional', () => {
    const schema = z.string().optional();
    const unwrapped = unwrapSchema(schema);
    const typeName = getTypeName(unwrapped);
    expect(typeName === 'ZodString' || typeName === 'string').toBe(true);
  });

  it('unwraps default', () => {
    const schema = z.string().default('hello');
    const unwrapped = unwrapSchema(schema);
    const typeName = getTypeName(unwrapped);
    expect(typeName === 'ZodString' || typeName === 'string').toBe(true);
  });

  it('unwraps nullable', () => {
    const schema = z.string().nullable();
    const unwrapped = unwrapSchema(schema);
    const typeName = getTypeName(unwrapped);
    expect(typeName === 'ZodString' || typeName === 'string').toBe(true);
  });

  it('unwraps multiple layers', () => {
    const schema = z.string().optional().nullable().default('test');
    const unwrapped = unwrapSchema(schema);
    const typeName = getTypeName(unwrapped);
    expect(typeName === 'ZodString' || typeName === 'string').toBe(true);
  });

  it('unwraps to enum', () => {
    const schema = z.enum(['a', 'b']).optional().default('a');
    const unwrapped = unwrapSchema(schema);
    const typeName = getTypeName(unwrapped);
    expect(typeName === 'ZodEnum' || typeName === 'enum').toBe(true);
    // Verify we can extract the enum values from the unwrapped schema
    const choices = extractEnumChoices(unwrapped);
    expect(choices).toEqual(['a', 'b']);
  });
});
