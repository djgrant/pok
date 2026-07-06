import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import {
  isBrokerEngaged,
  requestApproval,
  detectInitiator,
  toApprovalContext,
  BrokerDeniedError,
  isOperationalError,
  type ApprovalRequest,
} from '../src';

// =============================================================================
// Helpers
// =============================================================================

const tempDirs: string[] = [];
const servers: net.Server[] = [];

function makeSocketPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pok-broker-test-'));
  tempDirs.push(dir);
  return path.join(dir, 'pokd.sock');
}

/**
 * Start a mock broker daemon that answers each request line with the value
 * produced by `respond` (a raw string written verbatim, or null to never
 * respond).
 */
function startMockBroker(
  socketPath: string,
  respond: (request: any) => string | null
): Promise<net.Server> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) return;
        const message = JSON.parse(buffer.slice(0, newlineIndex));
        const response = respond(message);
        if (response !== null) {
          socket.write(response + '\n');
        }
      });
    });
    servers.push(server);
    server.listen(socketPath, () => resolve(server));
  });
}

function makeRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    repo: '/tmp/project',
    command: 'db migrate',
    task: 'Run migrations',
    keys: ['API_KEY', 'POSTGRES_URL'],
    context: { env: 'prod' },
    initiator: 'human',
    pid: process.pid,
    ...overrides,
  };
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise((resolve) => server.close(resolve));
  }
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// =============================================================================
// isBrokerEngaged
// =============================================================================

describe('isBrokerEngaged', () => {
  it('is not engaged when the socket does not exist', () => {
    const socketPath = makeSocketPath();
    expect(isBrokerEngaged({ POK_BROKER_SOCKET: socketPath })).toBe(false);
  });

  it('is engaged when the socket exists', async () => {
    const socketPath = makeSocketPath();
    await startMockBroker(socketPath, () => null);
    expect(isBrokerEngaged({ POK_BROKER_SOCKET: socketPath })).toBe(true);
  });

  it('is not engaged when POK_BROKER is "0" even if the socket exists', async () => {
    const socketPath = makeSocketPath();
    await startMockBroker(socketPath, () => null);
    expect(isBrokerEngaged({ POK_BROKER_SOCKET: socketPath, POK_BROKER: '0' })).toBe(false);
  });
});

// =============================================================================
// requestApproval
// =============================================================================

describe('requestApproval', () => {
  it('resolves allow when the daemon approves', async () => {
    const socketPath = makeSocketPath();
    let received: any;
    await startMockBroker(socketPath, (message) => {
      received = message;
      return JSON.stringify({
        v: 1,
        type: 'approval.response',
        id: message.id,
        decision: 'allow',
        reason: 'approved via touch id',
      });
    });

    const response = await requestApproval(makeRequest(), { socketPath });

    expect(response).toEqual({ decision: 'allow', reason: 'approved via touch id' });
    expect(received.v).toBe(1);
    expect(received.type).toBe('approval.request');
    expect(received.request.keys).toEqual(['API_KEY', 'POSTGRES_URL']);
    expect(received.request.repo).toBe('/tmp/project');
  });

  it('resolves deny with the daemon reason', async () => {
    const socketPath = makeSocketPath();
    await startMockBroker(socketPath, (message) =>
      JSON.stringify({
        v: 1,
        type: 'approval.response',
        id: message.id,
        decision: 'deny',
        reason: 'user rejected',
      })
    );

    const response = await requestApproval(makeRequest(), { socketPath });
    expect(response).toEqual({ decision: 'deny', reason: 'user rejected' });
  });

  it('treats a timeout as deny', async () => {
    const socketPath = makeSocketPath();
    await startMockBroker(socketPath, () => null);

    const response = await requestApproval(makeRequest(), { socketPath, timeoutMs: 100 });
    expect(response).toEqual({ decision: 'deny', reason: 'approval timed out' });
  });

  it('treats unparseable JSON as deny', async () => {
    const socketPath = makeSocketPath();
    await startMockBroker(socketPath, () => 'not json at all');

    const response = await requestApproval(makeRequest(), { socketPath });
    expect(response).toEqual({ decision: 'deny', reason: 'malformed response from broker' });
  });

  it('treats a response with an unknown decision as deny', async () => {
    const socketPath = makeSocketPath();
    await startMockBroker(socketPath, (message) =>
      JSON.stringify({ v: 1, type: 'approval.response', id: message.id, decision: 'maybe' })
    );

    const response = await requestApproval(makeRequest(), { socketPath });
    expect(response).toEqual({ decision: 'deny', reason: 'malformed response from broker' });
  });

  it('treats a response with a mismatched id as deny', async () => {
    const socketPath = makeSocketPath();
    await startMockBroker(socketPath, () =>
      JSON.stringify({ v: 1, type: 'approval.response', id: 'wrong-id', decision: 'allow' })
    );

    const response = await requestApproval(makeRequest(), { socketPath });
    expect(response).toEqual({ decision: 'deny', reason: 'malformed response from broker' });
  });

  it('treats a connection error as deny (fail closed)', async () => {
    const socketPath = makeSocketPath();
    // Socket path exists as a plain file, not a listening socket
    fs.writeFileSync(socketPath, '');

    const response = await requestApproval(makeRequest(), { socketPath });
    expect(response.decision).toBe('deny');
    expect(response.reason).toBeTruthy();
  });
});

// =============================================================================
// BrokerDeniedError
// =============================================================================

describe('BrokerDeniedError', () => {
  it('is operational and includes keys and reason', () => {
    const error = new BrokerDeniedError(['API_KEY', 'POSTGRES_URL'], 'user rejected');
    expect(error.message).toBe(
      'Secret access denied by pok broker: API_KEY, POSTGRES_URL (user rejected)'
    );
    expect(isOperationalError(error)).toBe(true);
  });
});

// =============================================================================
// detectInitiator / toApprovalContext
// =============================================================================

describe('detectInitiator', () => {
  it('detects agent when an agent env var is set', () => {
    expect(detectInitiator({ CLAUDECODE: '1' })).toBe('agent');
    expect(detectInitiator({ CODEX_SANDBOX: 'yes' })).toBe('agent');
  });

  it('detects human when no agent env var is set (or empty)', () => {
    expect(detectInitiator({})).toBe('human');
    expect(detectInitiator({ AGENT: '' })).toBe('human');
  });
});

describe('toApprovalContext', () => {
  it('keeps primitives and drops non-primitive values', () => {
    expect(
      toApprovalContext({
        env: 'prod',
        count: 3,
        flag: true,
        empty: null,
        fn: () => {},
        obj: { nested: true },
        undef: undefined,
      })
    ).toEqual({ env: 'prod', count: 3, flag: true, empty: null });
  });
});
