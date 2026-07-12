import { describe, it, expect, beforeEach } from 'bun:test';
import { captureEvents } from './utils';
import { calls, resetCalls } from '../../../test/cases/22-with-hooks/command';

describe('Lifecycle hooks (definePreCommand / definePostCommand)', () => {
  beforeEach(() => {
    resetCalls();
  });

  it('runs the full lifecycle in order: pre.checks, pre.run, main.checks, main.run, post.checks, post.run', async () => {
    const { error } = await captureEvents(['with-hooks']);
    expect(error).toBeUndefined();
    expect(calls).toEqual([
      'pre.check',
      'pre.run',
      'main.check',
      'main.run prepared=true',
      'post.check',
      'post.run input=pkg-a,pkg-b',
    ]);
  });

  it('merges the pre-command return value into the main context', async () => {
    await captureEvents(['with-hooks']);
    expect(calls).toContain('main.run prepared=true');
  });

  it('passes the main return value to post as typed input', async () => {
    await captureEvents(['with-hooks']);
    expect(calls).toContain('post.run input=pkg-a,pkg-b');
  });

  it('skips the post-command when the main run throws', async () => {
    const { error } = await captureEvents(['with-hooks', '--fail']);
    expect(error).toBeDefined();
    expect(calls).toEqual(['pre.check', 'pre.run', 'main.check', 'main.run prepared=true']);
  });

  it('invokes the pre-command directly via its colon name', async () => {
    const { error } = await captureEvents(['pre:with-hooks']);
    expect(error).toBeUndefined();
    expect(calls).toEqual(['pre.check', 'pre.run']);
  });

  it('invokes the post-command directly with input undefined', async () => {
    const { error } = await captureEvents(['post:with-hooks']);
    expect(error).toBeUndefined();
    expect(calls).toEqual(['post.check', 'post.run input=none']);
  });

  it('hides hook nodes from root help but keeps the main command visible', async () => {
    const { stdout } = await captureEvents(['--help']);
    expect(stdout).toContain('with-hooks');
    expect(stdout).not.toContain('pre:with-hooks');
    expect(stdout).not.toContain('post:with-hooks');
  });
});
