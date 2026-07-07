import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { createAuditLog, type AuditLog } from './audit';
import { formatReason } from './approve';
import { createFrontendRegistry } from './frontend';
import { createGrantStore } from './grants';
import type { ApprovalRequest, ApprovalRequestBody, ApprovalResponse, Approver, ApproverResult } from './types';

export function defaultSocketPath(): string {
  return process.env.POK_BROKER_SOCKET || path.join(os.homedir(), '.pok', 'pokd.sock');
}

export interface ServerOptions {
  socketPath?: string;
  auditPath?: string;
  approver: Approver;
  log?: (line: string) => void;
  /** Timeout for approval.forward messages to a registered frontend (default 110s). */
  forwardTimeoutMs?: number;
}

export interface PokdServer {
  socketPath: string;
  auditPath: string;
  close(): Promise<void>;
}

function validateRequest(value: unknown): ApprovalRequest | string {
  if (typeof value !== 'object' || value === null) return 'request is not an object';
  const msg = value as Record<string, unknown>;
  if (msg.v !== 1) return `unsupported protocol version: ${JSON.stringify(msg.v)}`;
  if (msg.type !== 'approval.request') return `unsupported message type: ${JSON.stringify(msg.type)}`;
  if (typeof msg.id !== 'string' || msg.id.length === 0) return 'missing request id';
  const req = msg.request as Record<string, unknown> | undefined;
  if (typeof req !== 'object' || req === null) return 'missing request body';
  if (typeof req.repo !== 'string') return 'request.repo must be a string';
  if (typeof req.command !== 'string') return 'request.command must be a string';
  if (typeof req.task !== 'string') return 'request.task must be a string';
  if (!Array.isArray(req.keys) || !req.keys.every((k) => typeof k === 'string')) {
    return 'request.keys must be an array of strings';
  }
  if (typeof req.context !== 'object' || req.context === null) return 'request.context must be an object';
  if (req.initiator !== 'human' && req.initiator !== 'agent') return 'request.initiator must be "human" or "agent"';
  if (req.access !== undefined && req.access !== 'read' && req.access !== 'write') {
    return 'request.access must be "read" or "write"';
  }
  return msg as unknown as ApprovalRequest;
}

function isFrontendRegister(value: unknown): value is { name: string } {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return msg.v === 1 && msg.type === 'frontend.register' && typeof msg.name === 'string' && msg.name.length > 0;
}

function summarize(request: ApprovalRequestBody): string {
  const label = request.command || request.task || '(unnamed)';
  const access = request.access === 'write' ? ' access=write' : '';
  return `"${label}" keys=[${request.keys.join(',')}]${access} initiator=${request.initiator} repo=${path.basename(request.repo || '') || '?'}`;
}

export async function startServer(options: ServerOptions): Promise<PokdServer> {
  const socketPath = options.socketPath ?? defaultSocketPath();
  const audit: AuditLog = createAuditLog(options.auditPath);
  const log = options.log ?? ((line: string) => console.error(line));
  const frontends = createFrontendRegistry({ log, forwardTimeoutMs: options.forwardTimeoutMs });

  fs.mkdirSync(path.dirname(socketPath), { recursive: true });
  // Remove stale socket on boot.
  if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);

  const grants = createGrantStore();

  /**
   * Decide a request (protocol v1.2 order): a standing grant auto-allows
   * without any forward; otherwise the registered frontend when there is one
   * (storing any grant it attaches to an allow), else the local approver chain.
   */
  async function decide(id: string, request: ApprovalRequestBody): Promise<ApproverResult> {
    const covering = grants.check(request);
    if (covering) {
      const until = new Date(covering.expiresAt).toISOString();
      return { decision: 'allow', reason: `covered by standing grant until ${until}`, approver: 'standing-grant' };
    }
    if (frontends.hasFrontend()) {
      const outcome = await frontends.forward(id, request, formatReason(request));
      if (outcome !== 'fallback') {
        if (outcome.decision === 'allow' && outcome.grant) {
          const grant = grants.add(request, outcome.grant.ttlSeconds);
          log(
            `pokd: standing grant stored: ${path.basename(request.repo || '') || '?'} env=${String(grant.contextEnv ?? '-')} keys=[${grant.keys.join(',')}] ttl=${outcome.grant.ttlSeconds}s`,
          );
        }
        return { decision: outcome.decision, reason: outcome.reason, approver: outcome.approver };
      }
      // Frontend disconnected before answering → fall back to the chain.
    }
    return options.approver(request);
  }

  async function handleCliRequest(socket: net.Socket, line: string): Promise<void> {
    const respond = (response: ApprovalResponse) => {
      socket.end(JSON.stringify(response) + '\n');
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      log(`pokd: deny (malformed JSON)`);
      audit.append({ ts: new Date().toISOString(), request: { raw: line.slice(0, 2000) }, decision: 'error', reason: 'malformed JSON' });
      respond({ v: 1, type: 'approval.response', id: '', decision: 'deny', reason: 'malformed JSON' });
      return;
    }

    const validated = validateRequest(parsed);
    if (typeof validated === 'string') {
      const id = typeof (parsed as Record<string, unknown>)?.id === 'string' ? ((parsed as Record<string, unknown>).id as string) : '';
      log(`pokd: deny (invalid request: ${validated})`);
      audit.append({ ts: new Date().toISOString(), request: { raw: line.slice(0, 2000) }, decision: 'error', reason: validated });
      respond({ v: 1, type: 'approval.response', id, decision: 'deny', reason: `invalid request: ${validated}` });
      return;
    }

    const request = validated.request;
    log(`pokd: request ${summarize(request)}`);
    audit.append({ ts: new Date().toISOString(), request, decision: 'pending' });

    let result;
    try {
      result = await decide(validated.id, request);
    } catch (err) {
      result = {
        decision: 'deny' as const,
        reason: `approver error: ${err instanceof Error ? err.message : String(err)}`,
        approver: 'error',
      };
    }

    log(`pokd: ${result.decision} ${summarize(request)} (${result.reason} via ${result.approver})`);
    audit.append({ ts: new Date().toISOString(), request, decision: result.decision, reason: result.reason, approver: result.approver });
    respond({ v: 1, type: 'approval.response', id: validated.id, decision: result.decision, reason: result.reason });
  }

  const server = net.createServer((socket) => {
    let buffer = '';
    // A connection is untyped until its first line: an approval.request makes
    // it a one-shot CLI connection (protocol v1), a frontend.register makes it
    // a long-lived frontend connection (protocol v1.1 addendum).
    let mode: 'new' | 'cli' | 'frontend' = 'new';

    socket.setEncoding('utf-8');
    socket.on('error', () => socket.destroy());
    socket.on('data', (chunk: string) => {
      if (mode === 'cli') return; // one request per CLI connection; ignore the rest
      buffer += chunk;
      while (mode !== 'cli') {
        const newline = buffer.indexOf('\n');
        if (newline === -1) {
          if (buffer.length > 1_000_000) socket.destroy();
          return;
        }
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);

        if (mode === 'frontend') {
          frontends.handleLine(socket, line);
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          parsed = undefined;
        }
        if (isFrontendRegister(parsed)) {
          mode = 'frontend';
          frontends.register(socket, parsed.name);
        } else {
          mode = 'cli';
          void handleCliRequest(socket, line);
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => resolve());
  });
  fs.chmodSync(socketPath, 0o600);

  return {
    socketPath,
    auditPath: audit.path,
    close: () =>
      new Promise<void>((resolve) => {
        frontends.shutdown();
        server.close(() => {
          try {
            if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
          } catch {}
          resolve();
        });
      }),
  };
}
