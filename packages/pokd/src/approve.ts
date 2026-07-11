import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as readline from 'node:readline';
import type { ApprovalRequestBody, Approver, ApproverResult } from './types';

const MAX_REASON_LENGTH = 200;
const SWIFT_SOURCE = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', 'swift', 'approve.swift');

/**
 * Format the reason string shown in the approval dialog, e.g.:
 * pok: "db migrate" (env: prod) requests POSTGRES_URL, API_KEY — initiated by agent [repo: pok]
 * Kept under ~200 chars by truncating the key list with "+N more".
 */
export function formatReason(request: ApprovalRequestBody): string {
  const label = request.command || request.task || 'task';
  const env = request.context && typeof request.context['env'] === 'string' ? ` (env: ${request.context['env']})` : '';
  const repo = request.repo ? ` [repo: ${path.basename(request.repo)}]` : '';
  const suffix = ` — initiated by ${request.initiator}${repo}`;
  const verb = request.access === 'write' ? 'requests WRITE access to ' : 'requests ';
  const prefix = `pok: "${label}"${env} ${verb}`;

  const keys = request.keys;
  let shown = keys.length;
  const render = (n: number) => {
    const list = keys.slice(0, n).join(', ');
    const more = n < keys.length ? ` +${keys.length - n} more` : '';
    return prefix + list + more + suffix;
  };
  let reason = render(shown);
  while (reason.length > MAX_REASON_LENGTH && shown > 1) {
    shown--;
    reason = render(shown);
  }
  return reason;
}

function ensureTouchIdBinary(): string | null {
  try {
    const binDir = path.join(os.homedir(), '.pok', 'bin');
    const binPath = path.join(binDir, 'pok-approve');
    const sourceStat = fs.statSync(SWIFT_SOURCE);
    const binStat = fs.existsSync(binPath) ? fs.statSync(binPath) : null;
    if (binStat && binStat.mtimeMs >= sourceStat.mtimeMs) return binPath;

    const which = spawnSync('which', ['swiftc'], { stdio: 'ignore' });
    if (which.status !== 0) return null;

    fs.mkdirSync(binDir, { recursive: true });
    const compile = spawnSync(
      'swiftc',
      ['-O', '-framework', 'LocalAuthentication', '-framework', 'Foundation', '-o', binPath, SWIFT_SOURCE],
      { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120_000 },
    );
    if (compile.status !== 0) {
      console.error(`pokd: swiftc compile failed: ${compile.stderr?.toString().trim() ?? 'unknown error'}`);
      return null;
    }
    return binPath;
  } catch (err) {
    console.error(`pokd: could not prepare touch id binary: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function touchIdApprove(binPath: string, reason: string): ApproverResult | null {
  const result = spawnSync(binPath, [reason], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180_000 });
  if (result.error || result.status === null) return null; // binary failed to run → try next approver
  if (result.status === 0) return { decision: 'allow', reason: 'approved via touch id', approver: 'touch-id' };
  return { decision: 'deny', reason: 'denied via touch id', approver: 'touch-id' };
}

function osascriptApprove(reason: string): ApproverResult | null {
  const escaped = reason.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `display dialog "${escaped}" buttons {"Deny", "Allow"} default button "Deny" with title "pok trust broker" with icon caution`;
  const result = spawnSync('osascript', ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 });
  if (result.error || result.status === null) return null;
  const stdout = result.stdout?.toString() ?? '';
  if (result.status === 0 && stdout.includes('Allow')) {
    return { decision: 'allow', reason: 'approved via dialog', approver: 'osascript' };
  }
  // Non-zero exit = user hit Deny (dialog "cancel"-style) or dialog failed; both deny.
  return { decision: 'deny', reason: 'denied via dialog', approver: 'osascript' };
}

async function stdinApprove(reason: string): Promise<ApproverResult> {
  process.stderr.write(`\n${reason}\nAllow? [y/N] `);
  const rl = readline.createInterface({ input: process.stdin });
  try {
    const answer: string = await new Promise((resolve) => {
      rl.once('line', (line) => resolve(line));
    });
    if (/^y(es)?$/i.test(answer.trim())) {
      return { decision: 'allow', reason: 'approved via prompt', approver: 'stdin' };
    }
    return { decision: 'deny', reason: 'denied via prompt', approver: 'stdin' };
  } finally {
    rl.close();
  }
}

export function approverMode(platform: NodeJS.Platform = process.platform): string {
  return platform === 'darwin' ? 'touch id → dialog → deny' : 'stdin y/N prompt';
}

/**
 * Default approver chain.
 * darwin: compiled Swift Touch ID binary → osascript dialog → deny.
 * elsewhere: y/N prompt on the daemon's stdin.
 */
export function createApprover(platform: NodeJS.Platform = process.platform): Approver {
  return async (request: ApprovalRequestBody): Promise<ApproverResult> => {
    const reason = formatReason(request);
    if (platform === 'darwin') {
      const binPath = ensureTouchIdBinary();
      if (binPath) {
        const result = touchIdApprove(binPath, reason);
        if (result) return result;
      }
      const dialog = osascriptApprove(reason);
      if (dialog) return dialog;
      return { decision: 'deny', reason: 'no approver available', approver: 'auto-deny' };
    }
    return stdinApprove(reason);
  };
}
