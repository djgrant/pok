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
  createRunner,
  createEventBus,
  createRawPrompter,
  defineEnvResolver,
  defineTask,
  type ApprovalRequest,
  type Runner,
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
// Write-access brokering (runner writeEnvs choke point)
// =============================================================================

function createTestRunner(): Runner {
  return createRunner({
    cwd: '/tmp/project',
    context: {},
    extraArgs: [],
    quiet: true,
    eventBus: createEventBus(),
    prompter: createRawPrompter({}),
  });
}

/** Run `fn` with the broker socket env vars pointed at `socketPath`. */
async function withBrokerEnv(socketPath: string, fn: () => Promise<void>): Promise<void> {
  const previousSocket = process.env.POK_BROKER_SOCKET;
  const previousBroker = process.env.POK_BROKER;
  process.env.POK_BROKER_SOCKET = socketPath;
  delete process.env.POK_BROKER;
  try {
    await fn();
  } finally {
    if (previousSocket === undefined) delete process.env.POK_BROKER_SOCKET;
    else process.env.POK_BROKER_SOCKET = previousSocket;
    if (previousBroker === undefined) delete process.env.POK_BROKER;
    else process.env.POK_BROKER = previousBroker;
  }
}

/** A resolver whose write calls are recorded, plus a task that writes through it. */
function makeWriteFixture() {
  const writes: Array<Record<string, string>> = [];
  const resolver = defineEnvResolver({
    availableVars: ['API_TOKEN', 'NEW_SECRET'] as const,
    resolve: async () => ({}),
    write: async (values) => {
      writes.push(values as Record<string, string>);
    },
  });
  const task = defineTask({
    label: 'Save secrets',
    envWriter: { resolver, vars: ['API_TOKEN', 'NEW_SECRET'] as const },
    run: async (_r, ctx) => {
      await ctx.writeEnvs({ NEW_SECRET: 's3cret', API_TOKEN: 'tok' });
    },
  });
  return { writes, resolver, task };
}

describe('write-access brokering', () => {
  it('sends access "write" with the written keys and allows the write on approve', async () => {
    const socketPath = makeSocketPath();
    const requests: any[] = [];
    await startMockBroker(socketPath, (message) => {
      requests.push(message.request);
      return JSON.stringify({
        v: 1,
        type: 'approval.response',
        id: message.id,
        decision: 'allow',
      });
    });

    const { writes, task } = makeWriteFixture();
    await withBrokerEnv(socketPath, async () => {
      const runner = createTestRunner();
      await runner.run(task);
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].access).toBe('write');
    expect(requests[0].keys).toEqual(['API_TOKEN', 'NEW_SECRET']);
    expect(requests[0].task).toBe('Save secrets');
    expect(writes).toEqual([{ NEW_SECRET: 's3cret', API_TOKEN: 'tok' }]);
  });

  it('omits the access field on read approvals and requests writes separately', async () => {
    const socketPath = makeSocketPath();
    const requests: any[] = [];
    await startMockBroker(socketPath, (message) => {
      requests.push(message.request);
      return JSON.stringify({
        v: 1,
        type: 'approval.response',
        id: message.id,
        decision: 'allow',
      });
    });

    const { writes, resolver, task } = makeWriteFixture();
    const readingTask = defineTask({
      label: task.label,
      env: { resolver, vars: ['API_TOKEN'] as const },
      envWriter: task.envWriter,
      run: (task as any).run,
    });

    await withBrokerEnv(socketPath, async () => {
      const runner = createTestRunner();
      await runner.run(readingTask);
    });

    expect(requests).toHaveLength(2);
    // Read approval: no access field on the wire at all
    expect('access' in requests[0]).toBe(false);
    expect(requests[0].keys).toEqual(['API_TOKEN']);
    // Write approval: separate request with access "write"
    expect(requests[1].access).toBe('write');
    expect(requests[1].keys).toEqual(['API_TOKEN', 'NEW_SECRET']);
    expect(writes).toHaveLength(1);
  });

  it('blocks the resolver write when the broker denies', async () => {
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

    const { writes, task } = makeWriteFixture();
    await withBrokerEnv(socketPath, async () => {
      const runner = createTestRunner();
      let error: unknown;
      try {
        await runner.run(task);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(BrokerDeniedError);
      expect((error as Error).message).toBe(
        'Secret access denied by pok broker: API_TOKEN, NEW_SECRET (user rejected)'
      );
    });

    expect(writes).toHaveLength(0);
  });

  it('writes without any approval request when the broker is not engaged', async () => {
    // Point at a socket path that does not exist on disk
    const socketPath = makeSocketPath();

    const { writes, task } = makeWriteFixture();
    await withBrokerEnv(socketPath, async () => {
      const runner = createTestRunner();
      await runner.run(task);
    });

    expect(writes).toEqual([{ NEW_SECRET: 's3cret', API_TOKEN: 'tok' }]);
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
