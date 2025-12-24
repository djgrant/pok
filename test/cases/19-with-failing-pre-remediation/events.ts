import type { CLIEvent } from '@openpok/core';

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
    label: 'Fails with remediation',
  },
  {
    type: 'activity:failure',
    id: 'activity-1',
    error: 'Docker daemon is not running',
    remediation: [
      "Start Docker Desktop, or",
      "Run 'sudo systemctl start docker' (Linux)",
    ],
    documentationUrl: 'https://docs.docker.com/get-started/',
  },
  {
    type: 'group:end',
    id: 'group-0',
  },
];
