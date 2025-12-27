import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { CLIError, generateUsageLine } from '../src/lib/cli-error';
import type { ContextDef } from '../src';

// =============================================================================
// Test Fixtures
// =============================================================================

const deployContextDef = {
  env: {
    from: 'flag' as const,
    schema: z.enum(['staging', 'prod']),
    description: 'Deployment environment',
  },
  dryRun: {
    from: 'flag' as const,
    schema: z.boolean().default(false),
    description: 'Run without making changes',
  },
} satisfies ContextDef;

const requiredStringContextDef = {
  name: {
    from: 'flag' as const,
    schema: z.string(),
    description: 'Required name',
  },
  tag: {
    from: 'flag' as const,
    schema: z.string().optional(),
    description: 'Optional tag',
  },
} satisfies ContextDef;

// =============================================================================
// CLIError Tests
// =============================================================================

describe('CLIError', () => {
  describe('format()', () => {
    it('formats error with usage line and help hint', () => {
      const error = new CLIError('Required flag --env is missing', {
        appName: 'mycli',
        commandPath: ['deploy'],
        contextDef: deployContextDef,
      });

      const formatted = error.format();

      expect(formatted).toContain('Error: Required flag --env is missing');
      expect(formatted).toContain('Usage: mycli deploy');
      expect(formatted).toContain("Run 'mycli deploy --help' for more information.");
    });

    it('shows enum choices in usage line', () => {
      const error = new CLIError('Required flag --env is missing', {
        appName: 'mycli',
        commandPath: ['deploy'],
        contextDef: deployContextDef,
      });

      const formatted = error.format();

      expect(formatted).toContain('--env <staging|prod>');
    });

    it('shows optional flags in brackets', () => {
      const error = new CLIError('Some error', {
        appName: 'mycli',
        commandPath: ['deploy'],
        contextDef: deployContextDef,
      });

      const formatted = error.format();

      // dryRun is optional (has default)
      expect(formatted).toContain('[--dry-run]');
    });

    it('shows required flags without brackets', () => {
      const error = new CLIError('Some error', {
        appName: 'mycli',
        commandPath: ['create'],
        contextDef: requiredStringContextDef,
      });

      const formatted = error.format();

      // name is required, tag is optional
      expect(formatted).toContain('--name <value>');
      expect(formatted).toContain('[--tag <value>]');
    });

    it('handles deeply nested commands', () => {
      const error = new CLIError('Error', {
        appName: 'mycli',
        commandPath: ['db', 'migrate', 'up'],
        contextDef: {},
      });

      const formatted = error.format();

      expect(formatted).toContain("Run 'mycli db migrate up --help' for more information.");
    });

    it('works without contextDef', () => {
      const error = new CLIError('Unknown command: foo', {
        appName: 'mycli',
        commandPath: [],
      });

      const formatted = error.format();

      expect(formatted).toContain('Error: Unknown command: foo');
      expect(formatted).toContain("Run 'mycli --help' for more information.");
      // Should not have usage line since no contextDef
      expect(formatted).not.toContain('Usage:');
    });

    it('converts camelCase flags to kebab-case', () => {
      const contextDef = {
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

      const error = new CLIError('Error', {
        appName: 'mycli',
        commandPath: ['publish'],
        contextDef,
      });

      const formatted = error.format();

      expect(formatted).toContain('[--dry-run]');
      expect(formatted).toContain('[--no-git-checks]');
    });
  });

  describe('error properties', () => {
    it('has correct name', () => {
      const error = new CLIError('Test error', {
        appName: 'test',
        commandPath: [],
      });

      expect(error.name).toBe('CLIError');
    });

    it('preserves error message', () => {
      const error = new CLIError('Test error message', {
        appName: 'test',
        commandPath: [],
      });

      expect(error.message).toBe('Test error message');
    });

    it('preserves error context', () => {
      const context = {
        appName: 'mycli',
        commandPath: ['deploy'],
        contextDef: deployContextDef,
      };

      const error = new CLIError('Error', context);

      expect(error.context.appName).toBe('mycli');
      expect(error.context.commandPath).toEqual(['deploy']);
      expect(error.context.contextDef).toBe(deployContextDef);
    });

    it('is instance of Error', () => {
      const error = new CLIError('Error', {
        appName: 'test',
        commandPath: [],
      });

      expect(error instanceof Error).toBe(true);
    });
  });
});

// =============================================================================
// generateUsageLine Tests
// =============================================================================

describe('generateUsageLine', () => {
  it('generates usage line with command path', () => {
    const usage = generateUsageLine('mycli', ['deploy'], {});

    expect(usage).toBe('mycli deploy');
  });

  it('includes required flags', () => {
    const usage = generateUsageLine('mycli', ['deploy'], {
      env: {
        from: 'flag' as const,
        schema: z.string(),
        description: 'Environment',
      },
    });

    expect(usage).toBe('mycli deploy --env <value>');
  });

  it('includes optional flags in brackets', () => {
    const usage = generateUsageLine('mycli', ['deploy'], {
      tag: {
        from: 'flag' as const,
        schema: z.string().optional(),
        description: 'Tag',
      },
    });

    expect(usage).toBe('mycli deploy [--tag <value>]');
  });

  it('shows enum choices', () => {
    const usage = generateUsageLine('mycli', ['deploy'], {
      env: {
        from: 'flag' as const,
        schema: z.enum(['dev', 'staging', 'prod']),
        description: 'Environment',
      },
    });

    expect(usage).toBe('mycli deploy --env <dev|staging|prod>');
  });

  it('shows boolean flags as optional', () => {
    const usage = generateUsageLine('mycli', ['deploy'], {
      dryRun: {
        from: 'flag' as const,
        schema: z.boolean().default(false),
        description: 'Dry run',
      },
    });

    expect(usage).toBe('mycli deploy [--dry-run]');
  });

  it('handles multiple flags', () => {
    const usage = generateUsageLine('mycli', ['deploy'], deployContextDef);

    expect(usage).toContain('mycli deploy');
    expect(usage).toContain('--env <staging|prod>');
    expect(usage).toContain('[--dry-run]');
  });

  it('handles deeply nested commands', () => {
    const usage = generateUsageLine('mycli', ['db', 'migrate', 'up'], {});

    expect(usage).toBe('mycli db migrate up');
  });

  it('converts camelCase to kebab-case', () => {
    const usage = generateUsageLine('mycli', ['publish'], {
      dryRun: {
        from: 'flag' as const,
        schema: z.boolean().default(false),
        description: 'Dry run',
      },
    });

    expect(usage).toContain('[--dry-run]');
    expect(usage).not.toContain('--dryRun');
  });
});
