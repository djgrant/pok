import { defineTask } from '@pokjs/core';

export const runWithReporter = defineTask({
  label: 'Run task with reporter',
  run: async (_r, ctx) => {
    const { reporter } = ctx;

    reporter.info('Starting task...');
    await new Promise((resolve) => setTimeout(resolve, 10));

    reporter.info('Processing data...');
    await new Promise((resolve) => setTimeout(resolve, 10));

    reporter.success('Task completed successfully');
  },
});

export const runWithAllLogLevels = defineTask({
  label: 'Run task with all log levels',
  run: async (_r, ctx) => {
    const { reporter } = ctx;

    reporter.info('This is an info message');
    reporter.success('This is a success message');
    reporter.warn('This is a warning message');
  },
});
