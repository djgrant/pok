import type { CLIEvent } from '@pokjs/core';

export const events: CLIEvent[] = [
  {
    type: 'log',
    level: 'info',
    message: 'This is an info message',
  },
  {
    type: 'log',
    level: 'success',
    message: 'This is a success message',
  },
  {
    type: 'log',
    level: 'warn',
    message: 'This is a warning message',
  },
];
