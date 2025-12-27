import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  dryRunContext,
  createDryRunReporter,
  type WithDryRun,
  type DryRunReporter,
  type CommandReporter,
} from '@openpok/core';

describe('Dry Run', () => {
  describe('dryRunContext', () => {
    it('provides standard dry-run field definition', () => {
      expect(dryRunContext.dryRun).toBeDefined();
      expect(dryRunContext.dryRun.from).toBe('flag');
      expect(dryRunContext.dryRun.description).toBe(
        'Show what would be done without making changes'
      );
    });

    it('has boolean schema with false default', () => {
      const schema = dryRunContext.dryRun.schema;

      // Should default to false
      expect(schema.parse(undefined)).toBe(false);
      expect(schema.parse(false)).toBe(false);
      expect(schema.parse(true)).toBe(true);
    });

    it('can be spread into command context', () => {
      const context = {
        env: {
          from: 'flag' as const,
          schema: z.enum(['dev', 'prod']),
        },
        ...dryRunContext,
      };

      expect(context.env).toBeDefined();
      expect(context.dryRun).toBeDefined();
      expect(context.dryRun.from).toBe('flag');
    });
  });

  describe('WithDryRun type', () => {
    it('adds dryRun to context type', () => {
      type BaseContext = { env: string };
      type ContextWithDryRun = WithDryRun<BaseContext>;

      // Type test - this should compile
      const ctx: ContextWithDryRun = {
        env: 'dev',
        dryRun: true,
      };

      expect(ctx.env).toBe('dev');
      expect(ctx.dryRun).toBe(true);
    });
  });

  describe('createDryRunReporter', () => {
    function createMockReporter(): {
      reporter: CommandReporter;
      logs: { level: string; message: string }[];
    } {
      const logs: { level: string; message: string }[] = [];
      const reporter: CommandReporter = {
        info: (message: string) => logs.push({ level: 'info', message }),
        warn: (message: string) => logs.push({ level: 'warn', message }),
        error: (message: string | Error) =>
          logs.push({
            level: 'error',
            message: message instanceof Error ? message.message : message,
          }),
        success: (message: string) => logs.push({ level: 'success', message }),
        step: (message: string) => logs.push({ level: 'step', message }),
      };
      return { reporter, logs };
    }

    it('returns a DryRunReporter', () => {
      const { reporter } = createMockReporter();
      const dry: DryRunReporter = createDryRunReporter(reporter);

      expect(typeof dry.wouldExecute).toBe('function');
      expect(typeof dry.wouldRun).toBe('function');
      expect(typeof dry.summary).toBe('function');
    });

    describe('wouldExecute', () => {
      it('reports action with [DRY RUN] prefix', () => {
        const { reporter, logs } = createMockReporter();
        const dry = createDryRunReporter(reporter);

        dry.wouldExecute('Build application');

        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe('step');
        expect(logs[0].message).toBe('[DRY RUN] Would: Build application');
      });
    });

    describe('wouldRun', () => {
      it('reports command with [DRY RUN] prefix', () => {
        const { reporter, logs } = createMockReporter();
        const dry = createDryRunReporter(reporter);

        dry.wouldRun('npm run build');

        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe('step');
        expect(logs[0].message).toBe('[DRY RUN] Would run: npm run build');
      });
    });

    describe('summary', () => {
      it('reports all planned actions', () => {
        const { reporter, logs } = createMockReporter();
        const dry = createDryRunReporter(reporter);

        dry.summary(['Build application', 'Push to registry', 'Update load balancer']);

        expect(logs).toHaveLength(6);

        // Header
        expect(logs[0].level).toBe('info');
        expect(logs[0].message).toBe('[DRY RUN] Would execute:');

        // Actions
        expect(logs[1].level).toBe('step');
        expect(logs[1].message).toBe('  - Build application');
        expect(logs[2].level).toBe('step');
        expect(logs[2].message).toBe('  - Push to registry');
        expect(logs[3].level).toBe('step');
        expect(logs[3].message).toBe('  - Update load balancer');

        // Blank line + Footer
        expect(logs[4].level).toBe('info');
        expect(logs[4].message).toBe('');
        expect(logs[5].level).toBe('info');
        expect(logs[5].message).toBe('No changes were made.');
      });

      it('handles empty actions list', () => {
        const { reporter, logs } = createMockReporter();
        const dry = createDryRunReporter(reporter);

        dry.summary([]);

        expect(logs).toHaveLength(3);
        expect(logs[0].message).toBe('[DRY RUN] Would execute:');
        expect(logs[1].message).toBe('');
        expect(logs[2].message).toBe('No changes were made.');
      });

      it('handles single action', () => {
        const { reporter, logs } = createMockReporter();
        const dry = createDryRunReporter(reporter);

        dry.summary(['Deploy application']);

        expect(logs).toHaveLength(4);
        expect(logs[1].message).toBe('  - Deploy application');
        expect(logs[3].message).toBe('No changes were made.');
      });
    });
  });

  describe('integration patterns', () => {
    it('supports step-by-step dry-run reporting', () => {
      const { reporter, logs } = createMockReporter();
      const dry = createDryRunReporter(reporter);

      // Simulate step-by-step reporting
      dry.wouldExecute('Build application');
      dry.wouldExecute('Push to registry');
      dry.wouldRun('kubectl apply -f deployment.yaml');
      dry.wouldExecute('Run health checks');

      expect(logs).toHaveLength(4);
      expect(logs.map((l) => l.message)).toEqual([
        '[DRY RUN] Would: Build application',
        '[DRY RUN] Would: Push to registry',
        '[DRY RUN] Would run: kubectl apply -f deployment.yaml',
        '[DRY RUN] Would: Run health checks',
      ]);
    });

    function createMockReporter(): {
      reporter: CommandReporter;
      logs: { level: string; message: string }[];
    } {
      const logs: { level: string; message: string }[] = [];
      const reporter: CommandReporter = {
        info: (message: string) => logs.push({ level: 'info', message }),
        warn: (message: string) => logs.push({ level: 'warn', message }),
        error: (message: string | Error) =>
          logs.push({
            level: 'error',
            message: message instanceof Error ? message.message : message,
          }),
        success: (message: string) => logs.push({ level: 'success', message }),
        step: (message: string) => logs.push({ level: 'step', message }),
      };
      return { reporter, logs };
    }
  });
});
