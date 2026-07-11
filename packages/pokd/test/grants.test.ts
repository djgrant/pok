import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { startServer, type PokdServer } from '../src/server';
import type { ApprovalRequestBody, Approver } from '../src/types';

function makeRequest(id: string, overrides: Partial<ApprovalRequestBody> = {}) {
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
  next(): Promise<any>;
  close(): void;
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
  return {
    send: (message) => socket.write(JSON.stringify(message) + '\n'),
    next: () => {
      const line = lines.shift();
      if (line !== undefined) return Promise.resolve(JSON.parse(line));
      return new Promise((resolve) => waiters.push((l) => resolve(JSON.parse(l))));
    },
    close: () => socket.destroy(),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('pokd standing grants (protocol v1.2)', () => {
  let dir: string;
  let socketPath: string;
  let auditPath: string;
  let server: PokdServer | null = null;
  const logs: string[] = [];
  const frontends: FrontendClient[] = [];

  const chainDeny: Approver = async () => ({ decision: 'deny', reason: 'denied via chain', approver: 'chain-stub' });

  async function boot(approver: Approver = chainDeny) {
    server = await startServer({ socketPath, auditPath, approver, log: (l) => logs.push(l) });
  }

  async function registerFrontend(name = 'pok-trust'): Promise<FrontendClient> {
    const frontend = connectFrontend(socketPath);
    frontends.push(frontend);
    frontend.send({ v: 1, type: 'frontend.register', name });
    expect(await frontend.next()).toEqual({ v: 1, type: 'frontend.registered' });
    return frontend;
  }

  /** Forward the request, answer it with allow (+ optional grant), return the CLI response. */
  async function allowViaFrontend(frontend: FrontendClient, id: string, overrides: Partial<ApprovalRequestBody> = {}, grant?: unknown) {
    const cli = sendLine(socketPath, JSON.stringify(makeRequest(id, overrides)));
    const forward = await frontend.next();
    expect(forward.type).toBe('approval.forward');
    expect(forward.id).toBe(id);
    frontend.send({ v: 1, type: 'approval.result', id, decision: 'allow', ...(grant !== undefined ? { grant } : {}) });
    return JSON.parse(await cli);
  }

  function auditRecords(): any[] {
    return fs
      .readFileSync(auditPath, 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokd-grants-test-'));
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

  test('allow with a grant auto-allows a later identical request without forwarding', async () => {
    await boot();
    const frontend = await registerFrontend();

    const first = await allowViaFrontend(frontend, 'req-1', {}, { ttlSeconds: 28800 });
    expect(first.decision).toBe('allow');
    expect(logs.some((l) => l.includes('standing grant stored: pok env=prod keys=[API_KEY,POSTGRES_URL] ttl=28800s'))).toBe(true);

    // Identical request: auto-allowed, no forward reaches the frontend.
    const second = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest('req-2'))));
    expect(second.decision).toBe('allow');
    expect(second.reason).toMatch(/^covered by standing grant until \d{4}-\d{2}-\d{2}T/);
    expect(auditRecords().at(-1)).toMatchObject({ decision: 'allow', approver: 'standing-grant' });
    expect(logs.some((l) => l.startsWith('pokd: allow') && l.includes('via standing-grant'))).toBe(true);

    // Prove the frontend saw exactly one forward: the next message it receives
    // is the forward for a request the grant does NOT cover (different env).
    const cli3 = sendLine(socketPath, JSON.stringify(makeRequest('req-3', { context: { env: 'staging' } })));
    const forward = await frontend.next();
    expect(forward).toMatchObject({ type: 'approval.forward', id: 'req-3' });
    frontend.send({ v: 1, type: 'approval.result', id: 'req-3', decision: 'deny' });
    expect(JSON.parse(await cli3).decision).toBe('deny');
  });

  test('a key subset is covered; a superset is not', async () => {
    await boot();
    const frontend = await registerFrontend();
    await allowViaFrontend(frontend, 'req-1', { keys: ['API_KEY', 'POSTGRES_URL'] }, { ttlSeconds: 60 });

    // Subset: auto-allowed without a forward.
    const subset = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest('req-2', { keys: ['API_KEY'] }))));
    expect(subset.decision).toBe('allow');
    expect(auditRecords().at(-1).approver).toBe('standing-grant');

    // Superset: forwards again.
    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-3', { keys: ['API_KEY', 'POSTGRES_URL', 'EXTRA'] })));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-3');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-3', decision: 'deny' });
    expect(JSON.parse(await cli).decision).toBe('deny');
  });

  test('a different context.env is not covered', async () => {
    await boot();
    const frontend = await registerFrontend();
    await allowViaFrontend(frontend, 'req-1', { context: { env: 'prod' } }, { ttlSeconds: 60 });

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-2', { context: { env: 'dev' } })));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-2');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-2', decision: 'deny' });
    expect(JSON.parse(await cli).decision).toBe('deny');
  });

  test('a read grant does not cover a write request', async () => {
    await boot();
    const frontend = await registerFrontend();
    await allowViaFrontend(frontend, 'req-1', {}, { ttlSeconds: 60 }); // access absent → read grant

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-2', { access: 'write' })));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-2');
    expect(forward.reason).toContain('requests WRITE access to API_KEY, POSTGRES_URL');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-2', decision: 'deny' });
    expect(JSON.parse(await cli).decision).toBe('deny');
  });

  test('a write grant covers writes (and only the same access level)', async () => {
    await boot();
    const frontend = await registerFrontend();
    await allowViaFrontend(frontend, 'req-1', { access: 'write' }, { ttlSeconds: 60 });

    const write = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest('req-2', { access: 'write' }))));
    expect(write.decision).toBe('allow');
    expect(auditRecords().at(-1).approver).toBe('standing-grant');

    // A read request is not covered by the write grant → forwards.
    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-3')));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-3');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-3', decision: 'deny' });
    expect(JSON.parse(await cli).decision).toBe('deny');
  });

  test('an expired grant no longer covers requests', async () => {
    await boot();
    const frontend = await registerFrontend();
    await allowViaFrontend(frontend, 'req-1', {}, { ttlSeconds: 0.05 });

    await sleep(120);

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-2')));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-2');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-2', decision: 'deny' });
    expect(JSON.parse(await cli).decision).toBe('deny');
  });

  test('an invalid grant is ignored but the allow stands', async () => {
    await boot();
    const frontend = await registerFrontend();

    for (const [id, grant] of [
      ['req-1', { ttlSeconds: 0 }],
      ['req-2', { ttlSeconds: -5 }],
      ['req-3', { ttlSeconds: 86_401 }],
      ['req-4', { ttlSeconds: 'soon' }],
      ['req-5', 'not-an-object'],
    ] as const) {
      const response = await allowViaFrontend(frontend, id, {}, grant);
      expect(response.decision).toBe('allow');
    }
    expect(logs.filter((l) => l.includes('ignoring invalid grant')).length).toBe(5);
    expect(logs.some((l) => l.includes('standing grant stored'))).toBe(false);

    // No grant stored → the identical follow-up request forwards again.
    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-6')));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-6');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-6', decision: 'allow' });
    expect(JSON.parse(await cli).decision).toBe('allow');
  });

  test('a grant on a deny is ignored', async () => {
    await boot();
    const frontend = await registerFrontend();

    const cli = sendLine(socketPath, JSON.stringify(makeRequest('req-1')));
    await frontend.next();
    frontend.send({ v: 1, type: 'approval.result', id: 'req-1', decision: 'deny', grant: { ttlSeconds: 60 } });
    expect(JSON.parse(await cli).decision).toBe('deny');
    expect(logs.some((l) => l.includes('standing grant stored'))).toBe(false);

    // Nothing stored: the identical follow-up request forwards again.
    const cli2 = sendLine(socketPath, JSON.stringify(makeRequest('req-2')));
    const forward = await frontend.next();
    expect(forward.id).toBe('req-2');
    frontend.send({ v: 1, type: 'approval.result', id: 'req-2', decision: 'deny' });
    expect(JSON.parse(await cli2).decision).toBe('deny');
  });

  test('grants also short-circuit the local approver chain when no frontend is registered', async () => {
    let chainCalls = 0;
    await boot(async () => {
      chainCalls++;
      return { decision: 'allow', reason: 'approved via chain', approver: 'chain-stub' };
    });
    const frontend = await registerFrontend();
    await allowViaFrontend(frontend, 'req-1', {}, { ttlSeconds: 60 });
    frontend.close();
    frontends.length = 0;
    await sleep(20); // let the daemon observe the disconnect

    const response = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest('req-2'))));
    expect(response.decision).toBe('allow');
    expect(auditRecords().at(-1).approver).toBe('standing-grant');
    expect(chainCalls).toBe(0);
  });
});
