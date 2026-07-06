import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { startServer, type PokdServer } from '../src/server';
import type { ApprovalRequestBody, Approver } from '../src/types';

function makeRequest(id = 'req-1', overrides: Partial<ApprovalRequestBody> = {}) {
  return {
    v: 1,
    type: 'approval.request',
    id,
    request: {
      repo: '/home/me/projects/pok',
      command: 'db migrate',
      task: 'Run migrations',
      keys: ['API_KEY', 'POSTGRES_URL'],
      context: { env: 'prod' },
      initiator: 'agent',
      pid: 12345,
      ...overrides,
    },
  };
}

/** One-shot CLI client: send one line, resolve with the daemon's reply on close. */
function sendLine(socketPath: string, line: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let data = '';
    socket.setEncoding('utf-8');
    socket.on('error', reject);
    socket.on('data', (chunk: string) => {
      data += chunk;
    });
    socket.on('close', () => resolve(data.trim()));
    socket.write(line + '\n');
  });
}

interface FrontendClient {
  send(message: unknown): void;
  sendRaw(line: string): void;
  next(): Promise<any>;
  close(): void;
  closed: Promise<void>;
}

/** Long-lived NDJSON client used to play the frontend role. */
function connectFrontend(socketPath: string): FrontendClient {
  const socket = net.createConnection(socketPath);
  socket.setEncoding('utf-8');
  let buffer = '';
  const lines: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const waiter = waiters.shift();
      if (waiter) waiter(line);
      else lines.push(line);
    }
  });
  const closed = new Promise<void>((resolve) => socket.on('close', () => resolve()));
  return {
    send: (message) => socket.write(JSON.stringify(message) + '\n'),
    sendRaw: (line) => socket.write(line + '\n'),
    next: () => {
      const line = lines.shift();
      if (line !== undefined) return Promise.resolve(JSON.parse(line));
      return new Promise((resolve) => waiters.push((l) => resolve(JSON.parse(l))));
    },
    close: () => socket.destroy(),
    closed,
  };
}

describe('pokd frontend (protocol v1.1)', () => {
  let dir: string;
  let socketPath: string;
  let auditPath: string;
  let server: PokdServer | null = null;
  const logs: string[] = [];
  const frontends: FrontendClient[] = [];

  async function boot(approver: Approver, forwardTimeoutMs?: number) {
    server = await startServer({ socketPath, auditPath, approver, forwardTimeoutMs, log: (l) => logs.push(l) });
  }

  async function registerFrontend(name = 'pok-trust'): Promise<FrontendClient> {
    const frontend = connectFrontend(socketPath);
    frontends.push(frontend);
    frontend.send({ v: 1, type: 'frontend.register', name });
    const ack = await frontend.next();
    expect(ack).toEqual({ v: 1, type: 'frontend.registered' });
    return frontend;
  }

  function auditRecords(): any[] {
    return fs
      .readFileSync(auditPath, 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  }

  const chainDeny: Approver = async () => ({ decision: 'deny', reason: 'denied via chain', approver: 'chain-stub' });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokd-frontend-test-'));
    socketPath = path.join(dir, 'pokd.sock');
    auditPath = path.join(dir, 'audit.log');
    logs.length = 0;
  });

  afterEach(async () => {
    for (const frontend of frontends) frontend.close();
    frontends.length = 0;
    await server?.close();
    server = null;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('registered frontend receives the forward and its allow reaches the CLI client', async () => {
    await boot(chainDeny);
    const frontend = await registerFrontend();

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    const forward = await frontend.next();
    expect(forward.v).toBe(1);
    expect(forward.type).toBe('approval.forward');
    expect(forward.id).toBe('req-1');
    expect(forward.request.keys).toEqual(['API_KEY', 'POSTGRES_URL']);
    expect(forward.reason).toBe(
      'pok: "db migrate" (env: prod) requests API_KEY, POSTGRES_URL — initiated by agent [repo: pok]',
    );

    frontend.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'allow', reason: 'approved via touch id' });
    const response = JSON.parse(await cli);
    expect(response).toEqual({
      v: 1,
      type: 'approval.response',
      id: 'req-1',
      decision: 'allow',
      reason: 'approved via touch id',
    });

    const records = auditRecords();
    expect(records[1]).toMatchObject({
      decision: 'allow',
      reason: 'approved via touch id',
      approver: 'frontend:pok-trust',
    });
    expect(logs.some((l) => l.includes('frontend registered: pok-trust'))).toBe(true);
  });

  test('frontend deny reaches the CLI client and is audited', async () => {
    await boot(chainDeny);
    const frontend = await registerFrontend();

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    await frontend.next();
    frontend.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'deny' });

    const response = JSON.parse(await cli);
    expect(response.decision).toBe('deny');
    expect(response.reason).toBe('denied via frontend');
    expect(auditRecords()[1]).toMatchObject({ decision: 'deny', approver: 'frontend:pok-trust' });
  });

  test('tolerates out-of-order approval.result across concurrent requests', async () => {
    await boot(chainDeny);
    const frontend = await registerFrontend();

    const cli1 = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    const cli2 = sendLine(socketPath, JSON.stringify(makeRequest('req-2', { command: 'deploy' })));
    const forwards = [await frontend.next(), await frontend.next()];
    expect(forwards.map((f) => f.id).sort()).toEqual(['req-1', 'req-2']);

    frontend.send({ v: 1, type: 'approval.result', id: 'req-2', decision: 'deny' });
    frontend.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'allow' });

    const response1 = JSON.parse(await cli1);
    const response2 = JSON.parse(await cli2);
    expect(response1).toMatchObject({ id: 'req-1', decision: 'allow' });
    expect(response2).toMatchObject({ id: 'req-2', decision: 'deny' });
  });

  test('forward timeout denies the CLI client; a late frontend answer is ignored', async () => {
    await boot(chainDeny, 50);
    const frontend = await registerFrontend();

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    await frontend.next(); // forward arrives, frontend never answers in time

    const response = JSON.parse(await cli);
    expect(response.decision).toBe('deny');
    expect(response.reason).toBe('approval timed out');
    expect(auditRecords()[1]).toMatchObject({
      decision: 'deny',
      reason: 'approval timed out',
      approver: 'frontend:pok-trust',
    });

    // Late answer for the already-settled id is ignored; the daemon stays healthy.
    frontend.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'allow' });
    const followUp = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest('req-2'))));
    expect(followUp.id).toBe('req-2');
    expect(followUp.decision).toBe('deny');
  });

  test('frontend disconnect mid-request falls back to the chain approver', async () => {
    await boot(async () => ({ decision: 'allow', reason: 'approved via chain', approver: 'chain-stub' }));
    const frontend = await registerFrontend();

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    await frontend.next();
    frontend.close();

    const response = JSON.parse(await cli);
    expect(response).toMatchObject({ id: 'req-1', decision: 'allow', reason: 'approved via chain' });
    expect(auditRecords()[1]).toMatchObject({ decision: 'allow', approver: 'chain-stub' });
    expect(logs.some((l) => l.includes('frontend disconnected: pok-trust'))).toBe(true);

    // Subsequent requests keep using the chain until a frontend registers again.
    const followUp = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest('req-2'))));
    expect(followUp).toMatchObject({ id: 'req-2', decision: 'allow', reason: 'approved via chain' });
  });

  test('a second frontend replaces the first', async () => {
    await boot(chainDeny);
    const first = await registerFrontend('pok-trust');
    const second = await registerFrontend('pok-trust-2');

    expect(await first.next()).toEqual({ v: 1, type: 'frontend.replaced' });
    await first.closed;

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    const forward = await second.next();
    expect(forward.id).toBe('req-1');
    second.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'allow' });
    const response = JSON.parse(await cli);
    expect(response.decision).toBe('allow');
    expect(auditRecords()[1].approver).toBe('frontend:pok-trust-2');
    expect(logs.some((l) => l.includes('frontend replaced: pok-trust'))).toBe(true);
  });

  test('malformed frontend messages and unknown result ids are ignored', async () => {
    await boot(chainDeny);
    const frontend = await registerFrontend();

    frontend.sendRaw('not json {');
    frontend.send({ v: 1, type: 'something.else' });
    frontend.send({ v: 2, type: 'approval.result', id: 'req-1', decision: 'allow' });
    frontend.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'maybe' });
    frontend.send({ v: 1, type: 'approval.result', id: 'no-such-request', decision: 'allow' });

    // The connection stays registered and functional.
    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-1');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'allow' });
    expect(JSON.parse(await cli).decision).toBe('allow');

    expect(logs.filter((l) => l.includes('ignoring malformed frontend message')).length).toBeGreaterThanOrEqual(4);
  });

  test('CLI requests keep working unchanged when no frontend is registered', async () => {
    await boot(async () => ({ decision: 'allow', reason: 'approved via touch id', approver: 'stub' }));
    const response = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest('req-1'))));
    expect(response).toEqual({
      v: 1,
      type: 'approval.response',
      id: 'req-1',
      decision: 'allow',
      reason: 'approved via touch id',
    });
    expect(auditRecords()[1].approver).toBe('stub');
  });
});
