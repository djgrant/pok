import type { CLIEvent } from '@openpok/core';

export const events: CLIEvent[] = [
  {
    type: 'group:start',
    id: 'group-0',
    label: 'Work',
    layout: 'sequence',
  },
  {
    type: 'activity:start',
    id: 'activity-0',
    parentId: 'group-0',
    label: 'Succeeds',
  },
  {
    type: 'activity:success',
    id: 'activity-0',
  },
  {
    type: 'activity:start',
    id: 'activity-1',
    parentId: 'group-0',
    label: 'Fails',
  },
  {
    type: 'activity:failure',
    id: 'activity-1',
    error: 'Activity failed intentionally',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
];
