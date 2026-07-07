import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { generateHelp, generateRootHelp, hasHelpFlag, formatFlagLine } from '../src/lib/help';
import { getSchemaInfo } from '../src/lib/args';
import type { CommandConfig, CommandNode, ContextDef } from '../src';

// =============================================================================
// Test Fixtures
// =============================================================================

const simpleContextDef = {
  env: {
    from: 'flag' as const,
    schema: z.enum(['dev', 'staging', 'prod']),
    description: 'Target environment',
  },
  dryRun: {
    from: 'flag' as const,
    schema: z.boolean().default(false),
    description: 'Simulate without changes',
  },
  tag: {
    from: 'flag' as const,
    schema: z.string().optional(),
    description: 'Optional tag',
  },
} satisfies ContextDef;

const simpleCommand: CommandConfig = {
  label: 'Deploy to environment',
  context: simpleContextDef,
  run: async () => {},
};

const parentCommand: CommandConfig = {
  label: 'Database operations',
};

function createCommandNode(
  segment: string,
  config: CommandConfig,
  children: CommandNode[] = []
): CommandNode {
  const childMap = new Map<string, CommandNode>();
  for (const child of children) {
    childMap.set(child.segment, child);
  }
  return {
    path: [segment],
    segment,
    config,
    children: childMap,
  };
}

// =============================================================================
// hasHelpFlag Tests
// =============================================================================

describe('hasHelpFlag', () => {
  it('detects --help flag', () => {
    expect(hasHelpFlag(['--help'])).toBe(true);
    expect(hasHelpFlag(['deploy', '--help'])).toBe(true);
    expect(hasHelpFlag(['--help', 'deploy'])).toBe(true);
  });

  it('detects -h flag', () => {
    expect(hasHelpFlag(['-h'])).toBe(true);
    expect(hasHelpFlag(['deploy', '-h'])).toBe(true);
  });

  it('returns false when no help flag present', () => {
    expect(hasHelpFlag([])).toBe(false);
    expect(hasHelpFlag(['deploy'])).toBe(false);
    expect(hasHelpFlag(['--env', 'prod'])).toBe(false);
  });

  it('does not match partial flags', () => {
    expect(hasHelpFlag(['--helper'])).toBe(false);
    expect(hasHelpFlag(['-help'])).toBe(false);
  });
});

// =============================================================================
// formatFlagLine Tests
// =============================================================================

describe('formatFlagLine', () => {
  it('formats required enum flag correctly', () => {
    const fieldDef = simpleContextDef.env;
    const info = getSchemaInfo(fieldDef.schema);
    const line = formatFlagLine('env', fieldDef, info, 30);

    expect(line).toContain('--env');
    expect(line).toContain('<dev|staging|prod>');
    expect(line).toContain('Target environment');
    expect(line).toContain('required');
  });

  it('formats optional boolean flag with default', () => {
    const fieldDef = simpleContextDef.dryRun;
    const info = getSchemaInfo(fieldDef.schema);
    const line = formatFlagLine('dryRun', fieldDef, info, 30);

    expect(line).toContain('--dry-run');
    expect(line).toContain('Simulate without changes');
    expect(line).toContain('default: false');
    expect(line).not.toContain('required');
  });

  it('formats optional string flag', () => {
    const fieldDef = simpleContextDef.tag;
    const info = getSchemaInfo(fieldDef.schema);
    const line = formatFlagLine('tag', fieldDef, info, 30);

    expect(line).toContain('--tag');
    expect(line).toContain('<string>');
    expect(line).toContain('Optional tag');
    expect(line).not.toContain('required');
  });

  it('converts camelCase to kebab-case', () => {
    const fieldDef = simpleContextDef.dryRun;
    const info = getSchemaInfo(fieldDef.schema);
    const line = formatFlagLine('dryRun', fieldDef, info, 30);

    expect(line).toContain('--dry-run');
    expect(line).not.toContain('--dryRun');
  });

  it('includes aliases in the same flag line', () => {
    const fieldDef = {
      from: 'flag' as const,
      schema: z.string(),
      aliases: ['id', 'slug'],
      description: 'Epic reference',
    };
    const info = getSchemaInfo(fieldDef.schema);
    const line = formatFlagLine('epicRef', fieldDef, info, 40);

    expect(line).toContain('--epic-ref, --id, --slug');
  });
});

// =============================================================================
// generateHelp Tests
// =============================================================================

describe('generateHelp', () => {
  it('generates help for command with flags', () => {
    const help = generateHelp({
      commandPath: ['deploy'],
      command: simpleCommand,
      appName: 'mycli',
    });

    expect(help).toContain('Deploy to environment');
    expect(help).toContain('mycli deploy [flags]');
    expect(help).toContain('Flags:');
    expect(help).toContain('--env');
    expect(help).toContain('--dry-run');
    expect(help).toContain('--tag');
    expect(help).toContain('-h, --help');
  });

  it('shows required vs optional indicators', () => {
    const help = generateHelp({
      commandPath: ['deploy'],
      command: simpleCommand,
      appName: 'mycli',
    });

    expect(help).toContain('(required)');
    expect(help).toContain('(default: false)');
  });

  it('shows subcommands for parent command', () => {
    const migrateChild = createCommandNode('migrate', {
      label: 'Run database migrations',
      run: async () => {},
    });
    const seedChild = createCommandNode('seed', {
      label: 'Seed database with test data',
      run: async () => {},
    });

    const help = generateHelp({
      commandPath: ['db'],
      command: parentCommand,
      children: [migrateChild, seedChild],
      appName: 'mycli',
    });

    expect(help).toContain('Database operations');
    expect(help).toContain('mycli db <command>');
    expect(help).toContain('Available Commands:');
    expect(help).toContain('migrate');
    expect(help).toContain('Run database migrations');
    expect(help).toContain('seed');
    expect(help).toContain('Seed database with test data');
    expect(help).toContain('Use "mycli db <command> --help"');
  });

  it('shows pre-flight checks when present', () => {
    const commandWithChecks: CommandConfig = {
      label: 'Deploy',
      pre: [
        { label: 'Docker must be running', check: async () => {} },
        { label: 'AWS credentials configured', check: async () => {} },
      ],
      run: async () => {},
    };

    const help = generateHelp({
      commandPath: ['deploy'],
      command: commandWithChecks,
      appName: 'mycli',
    });

    expect(help).toContain('Pre-flight checks:');
    expect(help).toContain('- Docker must be running');
    expect(help).toContain('- AWS credentials configured');
  });

  it('does not show pre-flight section for dynamic checks', () => {
    const commandWithDynamicChecks: CommandConfig = {
      label: 'Deploy',
      pre: async () => {
        return { label: 'Dynamic check', check: async () => {} };
      },
      run: async () => {},
    };

    const help = generateHelp({
      commandPath: ['deploy'],
      command: commandWithDynamicChecks,
      appName: 'mycli',
    });

    expect(help).not.toContain('Pre-flight checks:');
  });

  it('handles command with no context', () => {
    const simpleCmd: CommandConfig = {
      label: 'Format code',
      run: async () => {},
    };

    const help = generateHelp({
      commandPath: ['format'],
      command: simpleCmd,
      appName: 'mycli',
    });

    expect(help).toContain('Format code');
    expect(help).toContain('mycli format');
    expect(help).toContain('Flags:');
    expect(help).toContain('-h, --help');
  });

  it('handles nested command paths', () => {
    const help = generateHelp({
      commandPath: ['generate', 'types', 'cloudflare'],
      command: { label: 'Generate Cloudflare types', run: async () => {} },
      appName: 'mycli',
    });

    expect(help).toContain('mycli generate types cloudflare');
  });
});

// =============================================================================
// generateRootHelp Tests
// =============================================================================

describe('generateRootHelp', () => {
  it('generates root help with all commands', () => {
    const commands = [
      createCommandNode('deploy', { label: 'Deploy to environment', run: async () => {} }),
      createCommandNode('build', { label: 'Build the project', run: async () => {} }),
      createCommandNode('db', { label: 'Database operations' }),
    ];

    const help = generateRootHelp({
      appName: 'mycli',
      commands,
    });

    expect(help).toContain('mycli');
    expect(help).toContain('Usage:');
    expect(help).toContain('mycli <command> [flags]');
    expect(help).toContain('Available Commands:');
    expect(help).toContain('deploy');
    expect(help).toContain('Deploy to environment');
    expect(help).toContain('build');
    expect(help).toContain('Build the project');
    expect(help).toContain('db');
    expect(help).toContain('Database operations');
    expect(help).toContain('-h, --help');
    expect(help).toContain('--version');
    expect(help).toContain('Use "mycli <command> --help"');
  });

  it('includes description when provided', () => {
    const help = generateRootHelp({
      appName: 'mycli',
      commands: [],
      description: 'Project automation toolkit',
    });

    expect(help).toContain('mycli - Project automation toolkit');
  });

  it('sorts commands alphabetically', () => {
    const commands = [
      createCommandNode('zebra', { label: 'Zebra command' }),
      createCommandNode('alpha', { label: 'Alpha command' }),
      createCommandNode('beta', { label: 'Beta command' }),
    ];

    const help = generateRootHelp({
      appName: 'mycli',
      commands,
    });

    const alphaPos = help.indexOf('alpha');
    const betaPos = help.indexOf('beta');
    const zebraPos = help.indexOf('zebra');

    expect(alphaPos).toBeLessThan(betaPos);
    expect(betaPos).toBeLessThan(zebraPos);
  });

  it('includes global context flags when provided', () => {
    const help = generateRootHelp({
      appName: 'mycli',
      commands: [],
      globalContext: {
        dir: {
          from: 'flag',
          schema: z.string(),
          description: 'Board directory override',
        },
      },
    });

    expect(help).toContain('--dir <string>');
    expect(help).toContain('Board directory override');
  });
});

// =============================================================================
// Integration-style Tests
// =============================================================================

describe('Help Generation Integration', () => {
  it('generates consistent output format', () => {
    const help = generateHelp({
      commandPath: ['deploy'],
      command: simpleCommand,
      appName: 'mycli',
    });

    // Check structure: empty line at start and end
    expect(help.startsWith('\n')).toBe(true);
    expect(help.endsWith('\n')).toBe(true);

    // Check sections are in order
    const labelPos = help.indexOf('Deploy to environment');
    const usagePos = help.indexOf('Usage:');
    const flagsPos = help.indexOf('Flags:');

    expect(labelPos).toBeLessThan(usagePos);
    expect(usagePos).toBeLessThan(flagsPos);
  });

  it('help text works in no-color mode (no ANSI codes)', () => {
    const help = generateHelp({
      commandPath: ['deploy'],
      command: simpleCommand,
      appName: 'mycli',
    });

    // Should not contain ANSI escape codes
    expect(help).not.toMatch(/\x1b\[/);
    expect(help).not.toMatch(/\u001b\[/);
  });
});

// =============================================================================
// Router Integration Tests (with console capture)
// =============================================================================

import { run, createRawReporterAdapter, createRawPrompter } from '../src';
import { COMMANDS_DIR, PROJECT_ROOT } from './utils/paths';
import { withBrokerDisabled } from './utils';

/**
 * Capture console.log output during test execution
 */
async function captureConsoleOutput(fn: () => Promise<void>): Promise<string> {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  };

  try {
    await fn();
  } finally {
    console.log = originalLog;
  }

  return output.join('\n');
}

/**
 * Run CLI with --help flag and capture output
 */
async function runWithHelp(args: string[]): Promise<{ output: string; error?: Error }> {
  const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
  const prompter = createRawPrompter({});

  let error: Error | undefined;
  const output = await captureConsoleOutput(async () => {
    try {
      await withBrokerDisabled(() =>
        run(args, {
          commandsDir: COMMANDS_DIR,
          projectRoot: PROJECT_ROOT,
          appName: 'cli-test',
          reporterAdapter,
          prompter,
        })
      );
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
  });

  return { output, error };
}

describe('Router --help Integration', () => {
  it('shows root help with --help flag', async () => {
    const { output, error } = await runWithHelp(['--help']);

    expect(error).toBeUndefined();
    expect(output).toContain('cli-test');
    expect(output).toContain('Usage:');
    expect(output).toContain('Available Commands:');
    expect(output).toContain('-h, --help');
  });

  it('shows root help with -h flag', async () => {
    const { output, error } = await runWithHelp(['-h']);

    expect(error).toBeUndefined();
    expect(output).toContain('cli-test');
    expect(output).toContain('Available Commands:');
  });

  it('shows command-specific help for with-context --help', async () => {
    const { output, error } = await runWithHelp(['with-context', '--help']);

    expect(error).toBeUndefined();
    expect(output).toContain('Command with context');
    expect(output).toContain('cli-test with-context');
    expect(output).toContain('Flags:');
    expect(output).toContain('--env');
    expect(output).toContain('--verbose');
    expect(output).toContain('Target environment');
    expect(output).toContain('Enable verbose output');
  });

  it('shows command help with -h shorthand', async () => {
    const { output, error } = await runWithHelp(['with-context', '-h']);

    expect(error).toBeUndefined();
    expect(output).toContain('Command with context');
  });

  it('shows help for parent command with children', async () => {
    const { output, error } = await runWithHelp(['parent', '--help']);

    expect(error).toBeUndefined();
    expect(output).toContain('Parent command');
    expect(output).toContain('Available Commands:');
    expect(output).toContain('child-a');
    expect(output).toContain('child-b');
  });

  it('shows help for nested child command', async () => {
    const { output, error } = await runWithHelp(['parent', 'child-a', '--help']);

    expect(error).toBeUndefined();
    expect(output).toContain('Child command A');
    expect(output).toContain('cli-test parent child-a');
  });

  it('exits cleanly without running command when --help is provided', async () => {
    const { output, error } = await runWithHelp(['with-context', '--help']);

    expect(error).toBeUndefined();
    // Should not contain output from the actual command execution
    expect(output).not.toContain('Running in');
  });

  it('shows pre-flight checks in help when static', async () => {
    const { output, error } = await runWithHelp(['with-pre', '--help']);

    expect(error).toBeUndefined();
    expect(output).toContain('Pre-flight checks:');
  });

  it('exits cleanly (no error = exit code 0) for all help scenarios', async () => {
    // Root help
    const root = await runWithHelp(['--help']);
    expect(root.error).toBeUndefined();

    // Command help
    const cmd = await runWithHelp(['with-context', '--help']);
    expect(cmd.error).toBeUndefined();

    // Parent command help
    const parent = await runWithHelp(['parent', '--help']);
    expect(parent.error).toBeUndefined();

    // Nested command help
    const nested = await runWithHelp(['parent', 'child-a', '--help']);
    expect(nested.error).toBeUndefined();
  });
});
