import { describe, test, expect } from 'bun:test';
import { formatReason, approverMode } from '../src/approve';
import type { ApprovalRequestBody } from '../src/types';

function request(overrides: Partial<ApprovalRequestBody> = {}): ApprovalRequestBody {
  return {
    repo: '/Users/me/repos/pok',
    command: 'db migrate',
    task: 'Run migrations',
    keys: ['POSTGRES_URL', 'API_KEY'],
    context: { env: 'prod' },
    initiator: 'agent',
    pid: 1,
    ...overrides,
  };
}

describe('formatReason', () => {
  test('renders command, env, keys, initiator and repo basename', () => {
    expect(formatReason(request())).toBe(
      'pok: "db migrate" (env: prod) requests POSTGRES_URL, API_KEY — initiated by agent [repo: pok]',
    );
  });

  test('falls back to task label when command is empty', () => {
    expect(formatReason(request({ command: '' }))).toContain('"Run migrations"');
  });

  test('omits env when context has none', () => {
    expect(formatReason(request({ context: {} }))).not.toContain('(env:');
  });

  test('omits repo when empty', () => {
    expect(formatReason(request({ repo: '' }))).not.toContain('[repo:');
  });

  test('truncates long key lists with +N more and stays under ~200 chars', () => {
    const keys = Array.from({ length: 40 }, (_, i) => `SOME_LONG_SECRET_KEY_NAME_${i}`);
    const reason = formatReason(request({ keys }));
    expect(reason.length).toBeLessThanOrEqual(200);
    expect(reason).toMatch(/\+\d+ more/);
    expect(reason).toContain('SOME_LONG_SECRET_KEY_NAME_0');
  });

  test('says "requests WRITE access to" for write requests', () => {
    expect(formatReason(request({ access: 'write' }))).toBe(
      'pok: "db migrate" (env: prod) requests WRITE access to POSTGRES_URL, API_KEY — initiated by agent [repo: pok]',
    );
  });

  test('read access (explicit or absent) keeps the plain "requests" phrasing', () => {
    expect(formatReason(request({ access: 'read' }))).toContain('requests POSTGRES_URL');
    expect(formatReason(request())).not.toContain('WRITE access');
  });

  test('keeps at least one key even if it overflows', () => {
    const reason = formatReason(request({ keys: ['X'.repeat(300)] }));
    expect(reason).toContain('X'.repeat(300));
    expect(reason).not.toContain('more');
  });
});

describe('approverMode', () => {
  test('describes the darwin chain', () => {
    expect(approverMode('darwin')).toContain('touch id');
  });
  test('describes the non-darwin prompt', () => {
    expect(approverMode('linux')).toContain('y/N');
  });
});
