import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { startServer, type PokdServer } from '../src/server';
import type { ApprovalRequestBody, Approver } from '../src/types';

function makeRequest(overrides: Partial<ApprovalRequestBody> = {}) {
  return {
    v: 1,
    type: 'approval.request',
    id: 'req-1',
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

describe('pokd server', () => {
  let dir: string;
  let socketPath: string;
  let auditPath: string;
  let server: PokdServer | null = null;
  const logs: string[] = [];

  async function boot(approver: Approver) {
    server = await startServer({ socketPath, auditPath, approver, log: (l) => logs.push(l) });
  }

  function auditRecords(): any[] {
    return fs
      .readFileSync(auditPath, 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokd-test-'));
    socketPath = path.join(dir, 'pokd.sock');
    auditPath = path.join(dir, 'audit.log');
    logs.length = 0;
  });

  afterEach(async () => {
    await server?.close();
    server = null;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('allows a valid request when the approver allows', async () => {
    let seen: ApprovalRequestBody | null = null;
    await boot(async (req) => {
      seen = req;
      return { decision: 'allow', reason: 'approved via touch id', approver: 'stub' };
    });

    const response = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest())));
    expect(response).toEqual({
      v: 1,
      type: 'approval.response',
      id: 'req-1',
      decision: 'allow',
      reason: 'approved via touch id',
    });
    expect(seen!.keys).toEqual(['API_KEY', 'POSTGRES_URL']);

    const records = auditRecords();
    expect(records).toHaveLength(2);
    expect(records[0].decision).toBe('pending');
    expect(records[1]).toMatchObject({
      decision: 'allow',
      reason: 'approved via touch id',
      approver: 'stub',
    });
    expect(records[1].request.command).toBe('db migrate');
    expect(records[1].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('denies when the approver denies', async () => {
    await boot(async () => ({ decision: 'deny', reason: 'denied via dialog', approver: 'stub' }));
    const response = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest())));
    expect(response.decision).toBe('deny');
    expect(response.reason).toBe('denied via dialog');
    expect(auditRecords()[1].decision).toBe('deny');
  });

  test('denies on malformed JSON without invoking the approver', async () => {
    let called = false;
    await boot(async () => {
      called = true;
      return { decision: 'allow', reason: 'nope', approver: 'stub' };
    });
    const response = JSON.parse(await sendLine(socketPath, 'not json {'));
    expect(response.decision).toBe('deny');
    expect(response.reason).toContain('malformed');
    expect(called).toBe(false);
    expect(auditRecords()[0].decision).toBe('error');
  });

  test('denies on invalid request shape (wrong version, bad fields)', async () => {
    let called = false;
    await boot(async () => {
      called = true;
      return { decision: 'allow', reason: '', approver: 'stub' };
    });

    for (const bad of [
      { ...makeRequest(), v: 2 },
      { ...makeRequest(), type: 'other' },
      { v: 1, type: 'approval.request', id: 'x', request: { repo: 1 } },
      { v: 1, type: 'approval.request', id: 'x' },
      makeRequest({ initiator: 'robot' as any }),
      makeRequest({ keys: 'API_KEY' as any }),
      makeRequest({ access: 'admin' as any }),
      makeRequest({ access: 42 as any }),
    ]) {
      const response = JSON.parse(await sendLine(socketPath, JSON.stringify(bad)));
      expect(response.decision).toBe('deny');
      expect(response.reason).toContain('invalid request');
    }
    expect(called).toBe(false);
    expect(auditRecords().every((r) => r.decision === 'error')).toBe(true);
  });

  test('denies when the approver throws', async () => {
    await boot(async () => {
      throw new Error('boom');
    });
    const response = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest())));
    expect(response.decision).toBe('deny');
    expect(response.reason).toContain('boom');
    expect(auditRecords()[1]).toMatchObject({ decision: 'deny', approver: 'error' });
  });

  test('removes a stale socket on boot and sets 0600 mode', async () => {
    fs.writeFileSync(socketPath, '');
    await boot(async () => ({ decision: 'deny', reason: '', approver: 'stub' }));
    const mode = fs.statSync(socketPath).mode & 0o777;
    expect(mode).toBe(0o600);
    // still functional after replacing the stale file
    const response = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest())));
    expect(response.decision).toBe('deny');
  });

  test('removes the socket on close', async () => {
    await boot(async () => ({ decision: 'deny', reason: '', approver: 'stub' }));
    await server!.close();
    expect(fs.existsSync(socketPath)).toBe(false);
    server = null;
  });

  test('accepts access "write" and logs access=write; absent access means read', async () => {
    const seen: ApprovalRequestBody[] = [];
    await boot(async (req) => {
      seen.push(req);
      return { decision: 'allow', reason: 'ok', approver: 'stub' };
    });

    const writeResponse = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest({ access: 'write' }))));
    expect(writeResponse.decision).toBe('allow');
    expect(seen[0]!.access).toBe('write');
    expect(logs.some((l) => l.includes('request') && l.includes('access=write'))).toBe(true);

    logs.length = 0;
    const readResponse = JSON.parse(await sendLine(socketPath, JSON.stringify(makeRequest({ access: 'read' }))));
    expect(readResponse.decision).toBe('allow');
    expect(logs.some((l) => l.includes('access=write'))).toBe(false);
  });

  test('logs one line per request and per decision', async () => {
    await boot(async () => ({ decision: 'allow', reason: 'ok', approver: 'stub' }));
    await sendLine(socketPath, JSON.stringify(makeRequest()));
    expect(logs.some((l) => l.includes('request') && l.includes('db migrate'))).toBe(true);
    expect(logs.some((l) => l.includes('allow') && l.includes('db migrate'))).toBe(true);
  });
});
