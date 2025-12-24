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
    level: 'success',
    message: 'Selected',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
  {
    type: 'group:start',
    id: 'group-1',
    label: 'Run all children example',
    layout: 'sequence',
  },
  {
    type: 'activity:start',
    id: 'activity-0',
    parentId: 'group-1',
    label: 'Task B',
  },
  {
    type: 'activity:success',
    id: 'activity-0',
  },
  {
    type: 'activity:start',
    id: 'activity-1',
    parentId: 'group-1',
    label: 'Task A',
  },
  {
    type: 'activity:success',
    id: 'activity-1',
  },
  {
    type: 'group:end',
    id: 'group-1',
  },
];
