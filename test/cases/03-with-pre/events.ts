import type { CLIEvent } from '@pokjs/core';

export const events: CLIEvent[] = [
  {
    type: 'group:start',
    id: 'group-0',
    label: 'Pre-flight Checks',
    layout: 'sequence',
  },
  {
    type: 'activity:start',
    id: 'activity-0',
    parentId: 'group-0',
    label: 'Always passes',
  },
  {
    type: 'activity:success',
    id: 'activity-0',
  },
  {
    type: 'activity:start',
    id: 'activity-1',
    parentId: 'group-0',
    label: 'Second check',
  },
  {
    type: 'activity:success',
    id: 'activity-1',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
];
