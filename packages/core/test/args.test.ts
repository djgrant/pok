import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  parseContext,
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
// resolveInteractiveContext Tests
// =============================================================================

describe('resolveInteractiveContext', () => {
  // Mock prompter for testing
  function createMockPrompter(responses: {
    select?: unknown[];
    multiselect?: unknown[][];
    confirm?: boolean[];
    text?: string[];
  }): Prompter {
    let selectIdx = 0;
    let multiselectIdx = 0;
    let confirmIdx = 0;
    let textIdx = 0;

    return {
      async select<T>(): Promise<T> {
        return (responses.select?.[selectIdx++] ?? 'dev') as T;
      },
      async multiselect<T>(): Promise<T[]> {
        return (responses.multiselect?.[multiselectIdx++] ?? []) as T[];
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

  describe('dynamic resolve options', () => {
    const tasks = [
      { id: 'TASK-001', title: 'First task' },
      { id: 'TASK-002', title: 'Second task' },
    ] as const;

    async function listTaskOptionPage({ cursor }: { cursor?: string }) {
      const start = cursor ? Number(cursor) : 0;
      const pageSize = 1;
      const page = tasks.slice(start, start + pageSize);

      await new Promise((r) => setTimeout(r, 10));

      return {
        options: page.map((task) => task.id),
        nextCursor: start + pageSize < tasks.length ? String(start + pageSize) : undefined,
      };
    }

    it('uses resolve() options for single selection', async () => {
      const contextDef = {
        id: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Task id',
          resolve: async () => ({
            options: ['TASK-001', 'TASK-002'],
          }),
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['TASK-002'] });
      const result = await resolveInteractiveContext(
        { id: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.id).toBe('TASK-002');
    });

    it('accepts primitive option arrays from resolve()', async () => {
      const contextDef = {
        branch: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Git branch',
          resolve: async () => ['main', 'release'],
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['release'] });
      const result = await resolveInteractiveContext(
        { branch: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.branch).toBe('release');
    });

    it('preserves number option values as numbers', async () => {
      const contextDef = {
        count: {
          from: 'flag' as const,
          schema: z.number().int(),
          description: 'Item count',
          resolve: async () => [1, 2, 3],
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: [2] });
      const result = await resolveInteractiveContext(
        { count: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.count).toBe(2);
      expect(typeof result.count).toBe('number');
    });

    it('passes typed primitive values to the prompter options', async () => {
      const contextDef = {
        count: {
          from: 'flag' as const,
          schema: z.number().int(),
          description: 'Item count',
          resolve: async () => [1, 2, 3],
        },
      } satisfies ContextDef;

      let optionValues: unknown[] = [];
      const prompter: Prompter = {
        async select<T>(options): Promise<T> {
          optionValues = options.options.map((option) => option.value);
          return 2 as T;
        },
        async multiselect<T>(): Promise<T[]> {
          return [] as T[];
        },
        async confirm(): Promise<boolean> {
          return false;
        },
        async text(): Promise<string> {
          return '';
        },
      };

      await resolveInteractiveContext({ count: undefined } as any, contextDef, new Map(), prompter, false);
      expect(optionValues).toEqual([1, 2, 3]);
    });

    it('preserves boolean option values as booleans', async () => {
      const contextDef = {
        approved: {
          from: 'flag' as const,
          schema: z.boolean(),
          description: 'Approval state',
          resolve: async () => [true, false],
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: [true] });
      const result = await resolveInteractiveContext(
        { approved: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.approved).toBe(true);
      expect(typeof result.approved).toBe('boolean');
    });

    it('uses resolve() options for multi selection when schema is array', async () => {
      const contextDef = {
        ids: {
          from: 'flag' as const,
          schema: z.array(z.string()),
          description: 'Task ids',
          resolve: async () => ({
            options: ['TASK-001', 'TASK-002'],
          }),
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ multiselect: [['TASK-001', 'TASK-002']] });
      const result = await resolveInteractiveContext(
        { ids: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.ids).toEqual(['TASK-001', 'TASK-002']);
    });

    it('validates single-select result against schema before storing it', async () => {
      const contextDef = {
        count: {
          from: 'flag' as const,
          schema: z.number().int(),
          description: 'Count',
          resolve: async () => [1, 2, 3],
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['not-a-number'] });
      await expect(
        resolveInteractiveContext({ count: undefined } as any, contextDef, new Map(), prompter, false)
      ).rejects.toThrow('Invalid selected value for --count');
    });

    it('validates multi-select result against schema before storing it', async () => {
      const contextDef = {
        ids: {
          from: 'flag' as const,
          schema: z.array(z.number().int()),
          description: 'Numeric ids',
          resolve: async () => [1, 2, 3],
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ multiselect: [['bad', 2]] });
      await expect(
        resolveInteractiveContext({ ids: undefined } as any, contextDef, new Map(), prompter, false)
      ).rejects.toThrow('Invalid selected value for --ids');
    });

    it('supports async iterator pagination in resolve()', async () => {
      const contextDef = {
        id: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Task id',
          resolve: async function* () {
            yield {
              options: ['TASK-001'],
              nextCursor: 'page-2',
            };
            yield {
              options: ['TASK-002'],
            };
          },
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['TASK-002'] });
      const result = await resolveInteractiveContext(
        { id: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.id).toBe('TASK-002');
    });

    it('selects from later pages with async paginated resolve()', async () => {
      const contextDef = {
        id: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Task id',
          resolve: async ({ cursor }) => listTaskOptionPage({ cursor }),
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['TASK-002'] });
      const result = await resolveInteractiveContext(
        { id: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.id).toBe('TASK-002');
    });

    it('rejects repeated cursors in paginated resolve() to avoid infinite loops', async () => {
      const contextDef = {
        id: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Task id',
          resolve: async ({ cursor }) => ({
            options: ['TASK-001'],
            nextCursor: cursor ? 'loop' : 'loop',
          }),
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['TASK-001'] });
      await expect(
        resolveInteractiveContext({ id: undefined } as any, contextDef, new Map(), prompter, false)
      ).rejects.toThrow('Context resolve() returned repeated cursor "loop"');
    });

    it('rejects non-primitive option values from resolve()', async () => {
      const contextDef = {
        id: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Task id',
          resolve: async () => [{ nested: true }] as any,
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['TASK-001'] });
      await expect(
        resolveInteractiveContext({ id: undefined } as any, contextDef, new Map(), prompter, false)
      ).rejects.toThrow('Context resolve() must return primitive option values');
    });

    it('supports cascading resolve() via dependsOn', async () => {
      const contextDef = {
        env: {
          from: 'flag' as const,
          schema: z.enum(['dev', 'prod']),
          description: 'Environment',
          resolve: async () => ['dev', 'prod'],
        },
        db: {
          from: 'flag' as const,
          schema: z.string(),
          description: 'Database',
          dependsOn: ['env'],
          resolve: async (_req, ctx) => {
            if (ctx.env === 'prod') {
              return ['prod-users', 'prod-analytics'];
            }
            return ['dev-users', 'dev-analytics'];
          },
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['prod', 'prod-analytics'] });
      const result = await resolveInteractiveContext(
        { env: undefined, db: undefined } as any,
        contextDef,
        new Map(),
        prompter,
        false
      );

      expect(result.env).toBe('prod');
      expect(result.db).toBe('prod-analytics');
    });

    it('rejects unknown dependsOn field names', async () => {
      const contextDef = {
        env: {
          from: 'flag' as const,
          schema: z.string(),
          resolve: async () => ['dev'],
        },
        db: {
          from: 'flag' as const,
          schema: z.string(),
          dependsOn: ['missing'],
          resolve: async () => ['db1'],
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['dev', 'db1'] });
      await expect(
        resolveInteractiveContext(
          { env: undefined, db: undefined } as any,
          contextDef,
          new Map(),
          prompter,
          false
        )
      ).rejects.toThrow('Unknown dependsOn "missing" for context field "db"');
    });

    it('rejects circular dependsOn relationships', async () => {
      const contextDef = {
        env: {
          from: 'flag' as const,
          schema: z.string(),
          dependsOn: ['db'],
          resolve: async () => ['dev'],
        },
        db: {
          from: 'flag' as const,
          schema: z.string(),
          dependsOn: ['env'],
          resolve: async () => ['db1'],
        },
      } satisfies ContextDef;

      const prompter = createMockPrompter({ select: ['dev', 'db1'] });
      await expect(
        resolveInteractiveContext(
          { env: undefined, db: undefined } as any,
          contextDef,
          new Map(),
          prompter,
          false
        )
      ).rejects.toThrow('Circular dependsOn in context: env -> db -> env');
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
