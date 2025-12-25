import type { CLIEvent } from '@openpok/core';

export const events: CLIEvent[] = [
  {
    type: 'group:start',
    id: 'group-0',
    label: 'cli-test',
    layout: 'sequence',
  },
  {
    type: 'log',
    level: 'info',
    message: 'cli-test > parent',
  },
  {
    type: 'log',
    level: 'success',
    message: 'Selected',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
];
