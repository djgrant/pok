import { defineTask } from '@pokjs/core';

export const execSimple = defineTask({
  label: 'Simple exec task',
  exec: 'echo "Simple task executed"',
});
