import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  parseContext,
  resolveInteractiveContext,
  validateRequiredContext,
  extractChoices,
} from '../src/lib/args';
import { generateHelp } from '../src/lib/help';
import { generateCompletions } from '../src/lib/completion';
import { defineCommand } from '../src/lib/command';
import type { ContextDef, CommandNode } from '../src';

describe('Static Context (Duck Typing Literals)', () => {
  const contextWithStatic = {
    env: 'prod',
    version: 1,
    debug: true,
    tag: {
      from: 'flag' as const,
      schema: z.string().default('v1'),
    },
  } satisfies ContextDef;

  it('allows defining a command with static context', () => {
    // This is a type-level test. If it compiles, it passes.
    const command = defineCommand({
      label: 'Test',
      context: {
        env: 'prod',
        count: 123,
        enabled: true,
        flag: {
          from: 'flag',
          schema: z.string(),
        },
      },
      run: (r, ctx) => {
        // ctx.context.env should be typed as string or 'prod'
        const env: string = ctx.context.env;
        const count: number = ctx.context.count;
        const enabled: boolean = ctx.context.enabled;
        const flag: string = ctx.context.flag;

        expect(env).toBe('prod');
        expect(count).toBe(123);
        expect(enabled).toBe(true);
      },
    });
    expect(command.label).toBe('Test');
  });

  it('allows defining a command with explicit CommandConfig type', () => {
    const config: import('../src/lib/command').CommandConfig = {
      label: 'Test',
      context: {
        env: 'prod',
      },
    };
    const command = defineCommand(config);
    expect(command.label).toBe('Test');
  });

  describe('parseContext', () => {
    it('includes static values in parsed context', () => {
      const { context } = parseContext([], contextWithStatic);
      expect(context.env).toBe('prod');
      expect(context.version).toBe(1);
      expect(context.debug).toBe(true);
      expect(context.tag).toBe('v1');
    });

    it('provides a descriptive error when static value is used as a flag', () => {
      expect(() => parseContext(['--env', 'dev'], contextWithStatic)).toThrow(
        'Cannot use --env as a flag because it is a static context value'
      );
    });
  });

  describe('resolveInteractiveContext', () => {
    it('skips static values during interaction', async () => {
      let promptCalled = false;
      const prompter = {
        select: async () => {
          promptCalled = true;
          return 'dev';
        },
        confirm: async () => {
          promptCalled = true;
          return false;
        },
        text: async () => {
          promptCalled = true;
          return '';
        },
      } as any;

      const context = { env: 'prod', version: 1, debug: true, tag: undefined } as any;
      const result = await resolveInteractiveContext(
        context,
        contextWithStatic,
        new Map(),
        prompter,
        true
      );

      expect(result.env).toBe('prod');
      expect(result.version).toBe(1);
      expect(result.debug).toBe(true);
      // tag IS a flag, so it might be prompted if fromMenu=true
      expect(promptCalled).toBe(true);
    });
  });

  describe('validateRequiredContext', () => {
    it('passes for static values', () => {
      const context = { env: 'prod', version: 1, debug: true, tag: 'v1' } as any;
      expect(() => validateRequiredContext(context, contextWithStatic)).not.toThrow();
    });
  });

  describe('help generation', () => {
    it('hides static values from help text', () => {
      const helpText = generateHelp({
        commandPath: ['test'],
        command: { label: 'Test', context: contextWithStatic },
        appName: 'pok',
      });

      expect(helpText).toContain('--tag');
      expect(helpText).not.toContain('--env');
      expect(helpText).not.toContain('--version');
      expect(helpText).not.toContain('--debug');
    });
  });

  describe('completions', () => {
    it('excludes static values from completions', () => {
      const node: CommandNode = {
        path: 'test',
        segment: 'test',
        config: { label: 'Test', context: contextWithStatic },
        children: new Map(),
      };
      const tree = new Map([['test', node]]);
      const completions = generateCompletions(['test', '--'], tree);

      expect(completions).toContain('--tag');
      expect(completions).not.toContain('--env');
      expect(completions).not.toContain('--version');
      expect(completions).not.toContain('--debug');
    });
  });
});
