import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  generateCompletionScript,
  generateCompletions,
  getInstallInstructions,
  isValidShell,
} from '../../packages/core/src/lib/completion';
import type { CommandConfig, CommandNode, CommandTree } from '@openpok/core';

// =============================================================================
// Test Fixtures
// =============================================================================

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
    path: segment,
    segment,
    config,
    children: childMap,
  };
}

function createCommandTree(nodes: CommandNode[]): CommandTree {
  const tree: CommandTree = new Map();
  for (const node of nodes) {
    tree.set(node.segment, node);
  }
  return tree;
}

const deployCommand: CommandConfig = {
  label: 'Deploy to environment',
  context: {
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
  },
  run: async () => {},
};

const buildCommand: CommandConfig = {
  label: 'Build the project',
  run: async () => {},
};

const dbParentCommand: CommandConfig = {
  label: 'Database operations',
  enableRunAllChildren: 'sequential',
};

const migrateCommand: CommandConfig = {
  label: 'Run migrations',
  run: async () => {},
};

const seedCommand: CommandConfig = {
  label: 'Seed database',
  run: async () => {},
};

// =============================================================================
// isValidShell Tests
// =============================================================================

describe('isValidShell', () => {
  it('recognizes valid shells', () => {
    expect(isValidShell('bash')).toBe(true);
    expect(isValidShell('zsh')).toBe(true);
    expect(isValidShell('fish')).toBe(true);
  });

  it('rejects invalid shells', () => {
    expect(isValidShell('sh')).toBe(false);
    expect(isValidShell('powershell')).toBe(false);
    expect(isValidShell('')).toBe(false);
    expect(isValidShell('BASH')).toBe(false);
  });
});

// =============================================================================
// generateCompletionScript Tests
// =============================================================================

describe('generateCompletionScript', () => {
  describe('bash', () => {
    it('generates valid bash completion script', () => {
      const script = generateCompletionScript('mycli', 'bash');

      expect(script).toContain('# mycli bash completion');
      expect(script).toContain('_mycli_completions()');
      expect(script).toContain('complete -F _mycli_completions mycli');
      expect(script).toContain('__complete');
    });

    it('sanitizes app name for function name', () => {
      const script = generateCompletionScript('my-cli', 'bash');

      expect(script).toContain('_my_cli_completions()');
    });
  });

  describe('zsh', () => {
    it('generates valid zsh completion script', () => {
      const script = generateCompletionScript('mycli', 'zsh');

      expect(script).toContain('#compdef mycli');
      expect(script).toContain('_mycli()');
      expect(script).toContain('compdef _mycli mycli');
      expect(script).toContain('__complete');
    });
  });

  describe('fish', () => {
    it('generates valid fish completion script', () => {
      const script = generateCompletionScript('mycli', 'fish');

      expect(script).toContain('# mycli fish completion');
      expect(script).toContain('complete -c mycli');
      expect(script).toContain('__complete');
    });
  });
});

// =============================================================================
// getInstallInstructions Tests
// =============================================================================

describe('getInstallInstructions', () => {
  it('provides bash installation instructions', () => {
    const instructions = getInstallInstructions('mycli', 'bash');

    expect(instructions).toContain('~/.bashrc');
    expect(instructions).toContain('source <(mycli completion bash)');
  });

  it('provides zsh installation instructions', () => {
    const instructions = getInstallInstructions('mycli', 'zsh');

    expect(instructions).toContain('~/.zshrc');
    expect(instructions).toContain('source <(mycli completion zsh)');
  });

  it('provides fish installation instructions', () => {
    const instructions = getInstallInstructions('mycli', 'fish');

    expect(instructions).toContain('~/.config/fish/completions/mycli.fish');
    expect(instructions).toContain('mycli completion fish >');
  });
});

// =============================================================================
// generateCompletions Tests
// =============================================================================

describe('generateCompletions', () => {
  const deployNode = createCommandNode('deploy', deployCommand);
  const buildNode = createCommandNode('build', buildCommand);
  const migrateNode = createCommandNode('migrate', migrateCommand);
  const seedNode = createCommandNode('seed', seedCommand);
  const dbNode = createCommandNode('db', dbParentCommand, [migrateNode, seedNode]);

  const tree = createCommandTree([deployNode, buildNode, dbNode]);

  describe('command completion', () => {
    it('completes top-level commands', () => {
      const completions = generateCompletions([''], tree);

      expect(completions).toContain('deploy');
      expect(completions).toContain('build');
      expect(completions).toContain('db');
    });

    it('filters commands by prefix', () => {
      const completions = generateCompletions(['d'], tree);

      expect(completions).toContain('deploy');
      expect(completions).toContain('db');
      expect(completions).not.toContain('build');
    });

    it('completes nested commands', () => {
      const completions = generateCompletions(['db', ''], tree);

      expect(completions).toContain('migrate');
      expect(completions).toContain('seed');
      expect(completions).toContain('all'); // enableRunAllChildren adds 'all'
    });

    it('filters nested commands by prefix', () => {
      const completions = generateCompletions(['db', 'm'], tree);

      expect(completions).toContain('migrate');
      expect(completions).not.toContain('seed');
    });
  });

  describe('flag completion', () => {
    it('completes flags for command', () => {
      const completions = generateCompletions(['deploy', '--'], tree);

      expect(completions).toContain('--env');
      expect(completions).toContain('--dry-run');
      expect(completions).toContain('--help');
    });

    it('filters flags by prefix', () => {
      const completions = generateCompletions(['deploy', '--e'], tree);

      expect(completions).toContain('--env');
      expect(completions).not.toContain('--dry-run');
    });

    it('completes flags for commands without context', () => {
      const completions = generateCompletions(['build', '--'], tree);

      expect(completions).toContain('--help');
    });
  });

  describe('flag value completion', () => {
    it('completes enum values', () => {
      const completions = generateCompletions(['deploy', '--env', ''], tree);

      expect(completions).toEqual(['dev', 'staging', 'prod']);
    });

    it('filters enum values by prefix', () => {
      const completions = generateCompletions(['deploy', '--env', 'p'], tree);

      expect(completions).toContain('prod');
      expect(completions).not.toContain('dev');
      expect(completions).not.toContain('staging');
    });

    it('completes boolean flag values', () => {
      const completions = generateCompletions(['deploy', '--dry-run', ''], tree);

      expect(completions).toContain('true');
      expect(completions).toContain('false');
    });
  });

  describe('edge cases', () => {
    it('handles empty args', () => {
      const completions = generateCompletions([], tree);

      expect(completions).toContain('deploy');
      expect(completions).toContain('build');
      expect(completions).toContain('db');
    });

    it('handles unknown command', () => {
      const completions = generateCompletions(['unknown', '--'], tree);

      // Should still suggest --help at root level
      expect(completions).toContain('--help');
    });

    it('ignores flags when determining command path', () => {
      const completions = generateCompletions(['deploy', '--env', 'dev', '--'], tree);

      expect(completions).toContain('--env');
      expect(completions).toContain('--dry-run');
    });
  });
});

// =============================================================================
// Router Integration Tests
// =============================================================================

import { run, createRawReporterAdapter, createRawPrompter } from '@openpok/core';
import { COMMANDS_DIR, PROJECT_ROOT } from './utils/paths';

/**
 * Capture console output during test execution
 */
async function captureOutput(fn: () => Promise<void>): Promise<{ stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(' '));
  };

  try {
    await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  };
}

/**
 * Run CLI with args and capture output
 */
async function runCli(
  args: string[]
): Promise<{ stdout: string; stderr: string; error?: Error }> {
  const reporterAdapter = createRawReporterAdapter({ onEvent: () => {} });
  const prompter = createRawPrompter({});

  let error: Error | undefined;
  const { stdout, stderr } = await captureOutput(async () => {
    try {
      await run(args, {
        commandsDir: COMMANDS_DIR,
        projectRoot: PROJECT_ROOT,
        appName: 'cli-test',
        reporterAdapter,
        prompter,
      });
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
  });

  return { stdout, stderr, error };
}

describe('Router completion integration', () => {
  describe('completion command', () => {
    it('generates bash completion script', async () => {
      const { stdout, error } = await runCli(['completion', 'bash']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('_cli_test_completions()');
      expect(stdout).toContain('complete -F _cli_test_completions cli-test');
    });

    it('generates zsh completion script', async () => {
      const { stdout, error } = await runCli(['completion', 'zsh']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('#compdef cli-test');
      expect(stdout).toContain('compdef _cli_test cli-test');
    });

    it('generates fish completion script', async () => {
      const { stdout, error } = await runCli(['completion', 'fish']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('complete -c cli-test');
    });

    it('shows installation instructions on stderr', async () => {
      const { stderr, error } = await runCli(['completion', 'bash']);

      expect(error).toBeUndefined();
      expect(stderr).toContain('source <(cli-test completion bash)');
    });

    it('defaults to detected shell when no shell specified', async () => {
      const { stdout, error } = await runCli(['completion']);

      expect(error).toBeUndefined();
      // Should output some completion script (shell-dependent)
      expect(stdout.length).toBeGreaterThan(0);
    });
  });

  describe('__complete command', () => {
    it('completes top-level commands', async () => {
      const { stdout, error } = await runCli(['__complete', '']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('simple');
      expect(stdout).toContain('with-context');
    });

    it('completes commands by prefix', async () => {
      const { stdout, error } = await runCli(['__complete', 'with']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('with-context');
      expect(stdout).not.toContain('simple');
    });

    it('completes flags for command', async () => {
      const { stdout, error } = await runCli(['__complete', 'with-context', '--']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('--env');
      expect(stdout).toContain('--verbose');
    });

    it('completes flag values', async () => {
      const { stdout, error } = await runCli(['__complete', 'with-context', '--env', '']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('dev');
      expect(stdout).toContain('staging');
      expect(stdout).toContain('prod');
    });

    it('completes nested commands', async () => {
      const { stdout, error } = await runCli(['__complete', 'parent', '']);

      expect(error).toBeUndefined();
      expect(stdout).toContain('child-a');
      expect(stdout).toContain('child-b');
    });
  });
});
