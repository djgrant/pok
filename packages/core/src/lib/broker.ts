/**
 * Trust-broker client (pok broker wire protocol v1).
 *
 * When a pok trust broker daemon (pokd) is running, secret resolution goes
 * through a human-approval choke point: before a task run calls any env
 * resolver, the runner sends a single approval request over the daemon's
 * unix socket covering the union of env keys the run will resolve. The
 * daemon prompts the user (e.g. Touch ID on darwin) and answers
 * allow/deny.
 *
 * The broker is strictly opt-in: it is engaged only when the socket path
 * exists on disk and `POK_BROKER` is not `"0"`. When not engaged, callers
 * must behave exactly as if this module did not exist.
 *
 * Once engaged, the client fails closed: a denial, a malformed response, a
 * connection error, or a timeout all result in the task not running its
 * resolvers.
 *
 * Transport: newline-delimited JSON over a unix domain socket, one
 * request/response pair per connection.
 */

import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { markOperational } from './errors';

/** Wire protocol version implemented by this client. */
export const BROKER_PROTOCOL_VERSION = 1;

/** Milliseconds to wait for an approval response before treating it as a deny. */
export const BROKER_APPROVAL_TIMEOUT_MS = 120_000;

/** The daemon's verdict on an approval request. */
export type ApprovalDecision = 'allow' | 'deny';

/** Who triggered the task run, as detected from the process environment. */
export type ApprovalInitiator = 'human' | 'agent';

/** Payload describing the task run that wants to resolve secrets. */
export interface ApprovalRequest {
  /** Absolute path to the project the task runs in. */
  repo: string;
  /** Space-joined command route path (empty string if unknown). */
  command: string;
  /** Task label (empty string if unknown). */
  task: string;
  /** Union of env var names the run will resolve (deduped, sorted). */
  keys: string[];
  /** JSON-safe subset of the resolver context (values coerced to primitives). */
  context: Record<string, string | number | boolean | null>;
  /** Whether the run was initiated by a human or an agent. */
  initiator: ApprovalInitiator;
  /** PID of the requesting process. */
  pid: number;
}

/** The daemon's response to an approval request. */
export interface ApprovalResponse {
  decision: ApprovalDecision;
  reason?: string;
}

/**
 * Thrown when the broker denies (or fails to approve) secret access for a
 * task run. Operational: presented as a clean message without a stack trace.
 */
export class BrokerDeniedError extends Error {
  constructor(keys: string[], reason: string) {
    super(`Secret access denied by pok broker: ${keys.join(', ')} (${reason})`);
    this.name = 'BrokerDeniedError';
    markOperational(this);
  }
}

/**
 * Resolve the broker socket path: `POK_BROKER_SOCKET` env var, defaulting to
 * `~/.pok/pokd.sock`.
 */
export function getBrokerSocketPath(env: Record<string, string | undefined> = process.env): string {
  return env.POK_BROKER_SOCKET || path.join(os.homedir(), '.pok', 'pokd.sock');
}

/**
 * True when the broker choke point should be applied: the socket path exists
 * on disk and `POK_BROKER` is not `"0"`.
 */
export function isBrokerEngaged(env: Record<string, string | undefined> = process.env): boolean {
  if (env.POK_BROKER === '0') {
    return false;
  }
  return fs.existsSync(getBrokerSocketPath(env));
}

/**
 * Detect the initiator per the protocol: `"agent"` if any of the known agent
 * env vars are set (non-empty), else `"human"`.
 */
export function detectInitiator(
  env: Record<string, string | undefined> = process.env
): ApprovalInitiator {
  const agentVars = ['CLAUDECODE', 'CLAUDE_CODE', 'AGENT', 'CODEX_SANDBOX'];
  return agentVars.some((key) => !!env[key]) ? 'agent' : 'human';
}

/**
 * Coerce a resolver context object to the JSON-safe primitive subset the
 * protocol allows. Non-primitive values are dropped.
 */
export function toApprovalContext(
  context: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(context)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    }
  }
  return result;
}

let requestCounter = 0;

/**
 * Send one approval request to the broker daemon and await its decision.
 *
 * Fail-closed semantics: connection errors, malformed responses, and
 * timeouts (120s) all resolve to a `deny` decision with an explanatory
 * reason — this function only rejects on programmer error. Callers should
 * throw {@link BrokerDeniedError} on any non-allow decision.
 */
export function requestApproval(
  request: ApprovalRequest,
  options: { socketPath?: string; timeoutMs?: number } = {}
): Promise<ApprovalResponse> {
  const socketPath = options.socketPath ?? getBrokerSocketPath();
  const timeoutMs = options.timeoutMs ?? BROKER_APPROVAL_TIMEOUT_MS;
  const id = `${process.pid}-${Date.now()}-${++requestCounter}`;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (response: ApprovalResponse): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(response);
    };

    const timer = setTimeout(() => {
      settle({ decision: 'deny', reason: 'approval timed out' });
    }, timeoutMs);

    const socket = net.createConnection(socketPath, () => {
      socket.write(
        JSON.stringify({
          v: BROKER_PROTOCOL_VERSION,
          type: 'approval.request',
          id,
          request,
        }) + '\n'
      );
    });

    socket.on('error', (error) => {
      settle({ decision: 'deny', reason: error.message });
    });

    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) return;

      const line = buffer.slice(0, newlineIndex);
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        settle({ decision: 'deny', reason: 'malformed response from broker' });
        return;
      }

      const response = parsed as Partial<{
        v: number;
        type: string;
        id: string;
        decision: string;
        reason: string;
      }>;

      if (
        !response ||
        typeof response !== 'object' ||
        response.type !== 'approval.response' ||
        response.id !== id ||
        (response.decision !== 'allow' && response.decision !== 'deny')
      ) {
        settle({ decision: 'deny', reason: 'malformed response from broker' });
        return;
      }

      settle({
        decision: response.decision,
        reason: typeof response.reason === 'string' ? response.reason : undefined,
      });
    });

    socket.on('close', () => {
      settle({ decision: 'deny', reason: 'broker closed connection without responding' });
    });
  });
}
