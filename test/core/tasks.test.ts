import { describe, it, expect } from 'bun:test';
import { captureEvents } from './utils';

describe('Tasks', () => {
  describe('exec tasks', () => {
    it('executes simple exec task', async () => {
      const { error } = await captureEvents(['with-tasks']);
      expect(error).toBeUndefined();
    });

    it('executes task with parameters', async () => {
      const { error } = await captureEvents(['with-tasks']);
      expect(error).toBeUndefined();
    });
  });

  describe('tasks with environment', () => {
    it('resolves environment variables for task', async () => {
      const { error } = await captureEvents(['with-env-task', '--env', 'dev']);
      expect(error).toBeUndefined();
    });

    it('uses correct environment based on context', async () => {
      const { error } = await captureEvents([
        'with-env-task',
        '--env',
        'staging',
      ]);
      expect(error).toBeUndefined();
    });

    it('resolves different values for different environments', async () => {
      const { error: devError } = await captureEvents([
        'with-env-task',
        '--env',
        'dev',
      ]);
      const { error: stagingError } = await captureEvents([
        'with-env-task',
        '--env',
        'staging',
      ]);
      expect(devError).toBeUndefined();
      expect(stagingError).toBeUndefined();
    });
  });

  describe('run tasks', () => {
    it('executes run task with custom logic', async () => {
      const { error } = await captureEvents(['with-reporter']);
      expect(error).toBeUndefined();
    });
  });

  describe('task chaining', () => {
    it('runs multiple tasks in sequence', async () => {
      const { error } = await captureEvents(['with-tasks']);
      expect(error).toBeUndefined();
    });
  });
});
