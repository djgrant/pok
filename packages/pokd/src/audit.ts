import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ApprovalRequestBody } from './types';

export interface AuditRecord {
  ts: string;
  request: ApprovalRequestBody | { raw: string };
  decision: 'allow' | 'deny' | 'pending' | 'error';
  reason?: string;
  approver?: string;
}

export function defaultAuditPath(): string {
  return path.join(os.homedir(), '.pok', 'audit.log');
}

export function createAuditLog(auditPath: string = defaultAuditPath()) {
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  return {
    path: auditPath,
    append(record: AuditRecord): void {
      fs.appendFileSync(auditPath, JSON.stringify(record) + '\n', { mode: 0o600 });
    },
  };
}

export type AuditLog = ReturnType<typeof createAuditLog>;
