/**
 * Process Manager for CLI Tabs
 *
 * Manages spawning, output buffering, and lifecycle of child processes.
 * Framework-agnostic - provides callbacks for UI frameworks to consume.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { TabStatus, TabProcess } from './types.js';

export const OUTPUT_BATCH_MS = 16;

// =============================================================================
// Types
// =============================================================================

/**
 * A tab specification for the tabbed terminal UI.
 * This is the internal format used by adapters after task resolution.
 */
export type TabSpec = {
  label: string;
  exec: string;
};

export type ProcessManagerCallbacks = {
  /** Called when new output lines are available for a tab */
  onOutputUpdate: (index: number, lines: string[]) => void;
  /** Called when a process status changes */
  onStatusChange: (index: number, status: TabStatus, exitCode?: number) => void;
  /** Called when a process encounters an error */
  onError: (index: number, error: string) => void;
};

export type ProcessManagerOptions = {
  /** Working directory for commands */
  cwd: string;
  /** Environment variables for commands */
  env: Record<string, string | undefined>;
  /** Callbacks for state updates */
  callbacks: ProcessManagerCallbacks;
};

type OutputBuffer = {
  lines: string[];
};

// =============================================================================
// ProcessManager Class
// =============================================================================

/**
 * Manages child processes for tabbed terminal UI.
 *
 * Features:
 * - Batched output updates (16ms) to reduce render frequency
 * - Process lifecycle management (start, restart, kill)
 * - Automatic cleanup on destroy
 */
export class ProcessManager {
  private items: TabSpec[];
  private options: ProcessManagerOptions;
  private processes: (ChildProcess | null)[] = [];
  private outputBuffers: Map<number, OutputBuffer> = new Map();
  private flushScheduled = false;
  private destroyed = false;

  constructor(items: TabSpec[], options: ProcessManagerOptions) {
    this.items = items;
    this.options = options;
    this.processes = new Array(items.length).fill(null);
  }

  /**
   * Get initial tab process states
   */
  getInitialTabs(): TabProcess[] {
    return this.items.map((item, i) => ({
      id: `tab-${i}`,
      label: item.label,
      exec: item.exec,
      output: [],
      status: 'running' as const,
    }));
  }

  /**
   * Start all processes
   */
  start(): void {
    if (this.destroyed) return;

    for (let i = 0; i < this.items.length; i++) {
      this.spawnProcess(i);
    }
  }

  /**
   * Restart a specific process
   */
  restart(index: number): void {
    if (this.destroyed) return;

    const item = this.items[index];
    if (!item) return;

    // Kill existing process
    const existingProc = this.processes[index];
    if (existingProc && !existingProc.killed) {
      existingProc.kill('SIGTERM');
    }

    // Clear output buffer
    this.outputBuffers.delete(index);

    // Notify UI to show "Restarting..."
    this.options.callbacks.onOutputUpdate(index, ['Restarting...', '']);
    this.options.callbacks.onStatusChange(index, 'running');

    // Spawn new process after short delay
    setTimeout(() => {
      if (!this.destroyed) {
        this.spawnProcess(index);
      }
    }, 100);
  }

  /**
   * Kill a specific process
   */
  kill(index: number): void {
    const proc = this.processes[index];
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }

    this.options.callbacks.onOutputUpdate(index, ['', 'Stopped']);
    this.options.callbacks.onStatusChange(index, 'stopped');
  }

  /**
   * Kill all processes
   */
  killAll(): void {
    for (const proc of this.processes) {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    }
  }

  /**
   * Destroy the manager and cleanup all resources
   */
  destroy(): void {
    this.destroyed = true;
    this.killAll();
    this.outputBuffers.clear();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private spawnProcess(index: number): void {
    const item = this.items[index];
    if (!item) return;

    const proc = spawn('sh', ['-c', item.exec], {
      cwd: this.options.cwd,
      env: {
        ...this.options.env,
        FORCE_COLOR: '1',
      } as NodeJS.ProcessEnv,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    this.processes[index] = proc;

    const handleData = (data: Buffer) => this.appendOutput(index, data);

    proc.stdout?.on('data', handleData);
    proc.stderr?.on('data', handleData);

    proc.on('close', (code) => {
      this.flushOutput();
      const status: TabStatus = code === 0 ? 'done' : 'error';
      this.options.callbacks.onStatusChange(index, status, code ?? undefined);
    });

    proc.on('error', (err) => {
      this.options.callbacks.onError(index, err.message);
      this.options.callbacks.onStatusChange(index, 'error');
    });
  }

  private appendOutput(index: number, data: Buffer): void {
    const text = data.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((line, idx, arr) => {
      return line || idx < arr.length - 1;
    });

    if (lines.length === 0) return;

    let buffer = this.outputBuffers.get(index);
    if (!buffer) {
      buffer = { lines: [] };
      this.outputBuffers.set(index, buffer);
    }
    buffer.lines.push(...lines);

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setTimeout(() => this.flushOutput(), OUTPUT_BATCH_MS);
  }

  private flushOutput(): void {
    this.flushScheduled = false;

    const buffersSnapshot = this.outputBuffers;
    this.outputBuffers = new Map();

    if (buffersSnapshot.size === 0) return;

    for (const [index, buffer] of buffersSnapshot.entries()) {
      if (buffer.lines.length > 0) {
        this.options.callbacks.onOutputUpdate(index, buffer.lines);
      }
    }
  }
}
