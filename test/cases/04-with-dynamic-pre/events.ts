import type { CLIEvent } from '@pokit/core';

export const eventsDev: CLIEvent[] = [
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
    type: 'group:end',
    id: 'group-0',
  },
];

export const eventsStaging: CLIEvent[] = [
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
    type: 'activity:start',
    id: 'activity-2',
    parentId: 'group-0',
    label: 'Conditional (pass)',
  },
  {
    type: 'activity:success',
    id: 'activity-2',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
];
