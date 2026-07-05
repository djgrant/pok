import { z } from 'zod';
import { defineCommand } from '@pokit/core';

// Simulated remote services, paged so the dynamic-options bridge has to follow
// nextCursor across pages.
const SERVICES = [
  { id: 'web', region: 'us-east-1' },
  { id: 'api', region: 'us-east-1' },
  { id: 'worker', region: 'eu-west-1' },
] as const;

async function listServicePage({ cursor }: { cursor?: string }) {
  const start = cursor ? Number(cursor) : 0;
  const pageSize = 2;
  const slice = SERVICES.slice(start, start + pageSize);
  // Simulate a network round-trip.
  await new Promise((resolve) => setTimeout(resolve, 10));
  return {
    options: slice.map((s) => ({ value: s.id, label: `${s.id} (${s.region})` })),
    nextCursor: start + pageSize < SERVICES.length ? String(start + pageSize) : undefined,
  };
}

// Dynamic-options select: the value is resolved asynchronously (and paged),
// so running with no `--service` flag pops an interactive, lazily-loaded picker.
export const command = defineCommand({
  label: 'Deploy a service',
  description: 'Dynamic (paged, async) select of services',
  context: {
    service: {
      from: 'flag',
      schema: z.string(),
      description: 'Service to deploy',
      resolve: async ({ cursor }) => listServicePage({ cursor }),
    },
  },
  run: async (r, { context }) => {
    await r.exec(`echo "Deploying ${context.service}..."`);
  },
});
