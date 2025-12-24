import type { CLIEvent } from '@openpok/core';

export const events: CLIEvent[] = [
  {
    type: 'group:start',
    id: 'group-0',
    label: 'Build Pipeline',
    layout: 'sequence',
  },
  {
    type: 'activity:start',
    id: 'activity-0',
    parentId: 'group-0',
    label: 'Prepare',
  },
  {
    type: 'activity:success',
    id: 'activity-0',
  },
  {
    type: 'group:start',
    id: 'group-1',
    label: 'Compile Phase',
    layout: 'sequence',
  },
  {
    type: 'activity:start',
    id: 'activity-1',
    parentId: 'group-1',
    label: 'Compile TypeScript',
  },
  {
    type: 'activity:success',
    id: 'activity-1',
  },
  {
    type: 'activity:start',
    id: 'activity-2',
    parentId: 'group-1',
    label: 'Bundle assets',
  },
  {
    type: 'activity:success',
    id: 'activity-2',
  },
  {
    type: 'group:end',
    id: 'group-1',
  },
  {
    type: 'activity:start',
    id: 'activity-3',
    parentId: 'group-0',
    label: 'Finalize',
  },
  {
    type: 'activity:success',
    id: 'activity-3',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
];
