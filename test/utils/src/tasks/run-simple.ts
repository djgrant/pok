import { defineTask } from '@pokjs/core';

export const runSimple = defineTask({
  label: 'Simple run task',
  run: async (r) => {
    await r.exec('echo "Step 1"');
    await r.exec('echo "Step 2"');
  },
});

export const runWithReturn = defineTask({
  label: 'Run task with return value',
  run: async () => {
    const result = { processed: 42, status: 'complete' };
    return result;
  },
});
