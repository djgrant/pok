import type { CLIEvent } from '@pokjs/core';

export const events: CLIEvent[] = [
  {
    type: 'group:start',
    id: 'group-0',
    label: 'Setup Phase',
    layout: 'sequence',
  },
  {
    type: 'activity:start',
    id: 'activity-0',
    parentId: 'group-0',
    label: 'Initialize',
  },
  {
    type: 'activity:success',
    id: 'activity-0',
  },
  {
    type: 'activity:start',
    id: 'activity-1',
    parentId: 'group-0',
    label: 'Configure',
  },
  {
    type: 'activity:success',
    id: 'activity-1',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
  {
    type: 'log',
    level: 'info',
    message: 'Starting task...',
  },
  {
    type: 'log',
    level: 'info',
    message: 'Processing data...',
  },
  {
    type: 'log',
    level: 'success',
    message: 'Task completed successfully',
  },
];
