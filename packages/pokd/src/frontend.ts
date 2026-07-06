import type * as net from 'node:net';
import type { ApprovalRequestBody, ApprovalResult, ApproverResult } from './types';

/**
 * Forward timeout for approval.forward messages: inside the CLI client's
 * 120s so the daemon (not the client) settles the request first.
 */
export const FORWARD_TIMEOUT_MS = 110_000;

/**
 * Outcome of forwarding a request to the frontend. `'fallback'` means the
 * frontend went away before answering; the caller should use the local
 * approver chain instead.
 */
export type ForwardOutcome = ApproverResult | 'fallback';

interface PendingForward {
  resolve: (outcome: ForwardOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Frontend {
  socket: net.Socket;
  name: string;
  pending: Map<string, PendingForward>;
  detached: boolean;
}

export interface FrontendRegistryOptions {
  log: (line: string) => void;
  forwardTimeoutMs?: number;
}

export interface FrontendRegistry {
  /** True while a frontend is registered (it is then the preferred approver). */
  hasFrontend(): boolean;
  /** Register a frontend connection, replacing (and closing) any previous one. */
  register(socket: net.Socket, name: string): void;
  /** Handle one NDJSON line received on a registered frontend connection. */
  handleLine(socket: net.Socket, line: string): void;
  /** Forward a request to the current frontend and await its decision. */
  forward(id: string, request: ApprovalRequestBody, reason: string): Promise<ForwardOutcome>;
  /** Close the frontend connection (daemon shutdown); pending forwards fall back. */
  shutdown(): void;
}

function validateResult(value: unknown): ApprovalResult | string {
  if (typeof value !== 'object' || value === null) return 'message is not an object';
  const msg = value as Record<string, unknown>;
  if (msg.v !== 1) return `unsupported protocol version: ${JSON.stringify(msg.v)}`;
  if (msg.type !== 'approval.result') return `unsupported message type: ${JSON.stringify(msg.type)}`;
  if (typeof msg.id !== 'string' || msg.id.length === 0) return 'missing result id';
  if (msg.decision !== 'allow' && msg.decision !== 'deny') return 'decision must be "allow" or "deny"';
  return msg as unknown as ApprovalResult;
}

/**
 * Tracks the (single) registered approver frontend and the approval
 * forwards awaiting its answer. See broker protocol v1.1 addendum.
 */
export function createFrontendRegistry(options: FrontendRegistryOptions): FrontendRegistry {
  const forwardTimeoutMs = options.forwardTimeoutMs ?? FORWARD_TIMEOUT_MS;
  let current: Frontend | null = null;

  const send = (socket: net.Socket, message: Record<string, unknown>) => {
    socket.write(JSON.stringify(message) + '\n');
  };

  /** Drop a frontend: pending forwards fall back to the local approver chain. */
  const detach = (frontend: Frontend, why: string) => {
    if (frontend.detached) return;
    frontend.detached = true;
    if (current === frontend) current = null;
    options.log(`pokd: frontend ${why}: ${frontend.name}`);
    for (const pending of frontend.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve('fallback');
    }
    frontend.pending.clear();
  };

  return {
    hasFrontend: () => current !== null,

    register(socket, name) {
      if (current) {
        const old = current;
        send(old.socket, { v: 1, type: 'frontend.replaced' });
        old.socket.end();
        detach(old, 'replaced');
      }
      const frontend: Frontend = { socket, name, pending: new Map(), detached: false };
      current = frontend;
      socket.on('close', () => detach(frontend, 'disconnected'));
      send(socket, { v: 1, type: 'frontend.registered' });
      options.log(`pokd: frontend registered: ${name}`);
    },

    handleLine(socket, line) {
      const frontend = current;
      if (!frontend || frontend.socket !== socket) return; // stale (replaced) connection

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        options.log(`pokd: ignoring malformed frontend message (malformed JSON)`);
        return;
      }
      const validated = validateResult(parsed);
      if (typeof validated === 'string') {
        options.log(`pokd: ignoring malformed frontend message (${validated})`);
        return;
      }

      const pending = frontend.pending.get(validated.id);
      if (!pending) return; // unknown or already-settled id (e.g. answered after timeout)
      frontend.pending.delete(validated.id);
      clearTimeout(pending.timer);
      const fallbackReason = validated.decision === 'allow' ? 'approved via frontend' : 'denied via frontend';
      pending.resolve({
        decision: validated.decision,
        reason: typeof validated.reason === 'string' ? validated.reason : fallbackReason,
        approver: `frontend:${frontend.name}`,
      });
    },

    forward(id, request, reason) {
      const frontend = current;
      if (!frontend) return Promise.resolve('fallback');
      return new Promise<ForwardOutcome>((resolve) => {
        const timer = setTimeout(() => {
          frontend.pending.delete(id);
          resolve({ decision: 'deny', reason: 'approval timed out', approver: `frontend:${frontend.name}` });
        }, forwardTimeoutMs);
        frontend.pending.set(id, { resolve, timer });
        send(frontend.socket, { v: 1, type: 'approval.forward', id, request, reason });
      });
    },

    shutdown() {
      if (current) current.socket.destroy();
    },
  };
}
