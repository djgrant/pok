#!/usr/bin/env bun
/**
 * pokd - pok trust-broker daemon.
 *
 * Runs in the foreground, listening on a unix socket for approval requests
 * from pok clients (see broker protocol v1). Every request is audited and
 * put to a human approver (Touch ID / dialog on macOS, y/N prompt elsewhere).
 */
import { startServer, defaultSocketPath } from '../src/server';
import { createApprover, approverMode } from '../src/approve';
import { defaultAuditPath } from '../src/audit';

const server = await startServer({
  socketPath: defaultSocketPath(),
  auditPath: defaultAuditPath(),
  approver: createApprover(),
});

console.error(`pokd: listening on ${server.socketPath}`);
console.error(`pokd: audit log at ${server.auditPath}`);
console.error(`pokd: approver: ${approverMode()}`);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`pokd: received ${signal}, shutting down`);
  await server.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
