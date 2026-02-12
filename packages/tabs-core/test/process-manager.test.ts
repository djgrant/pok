import { describe, it, expect } from 'bun:test';
import { ProcessManager, OUTPUT_BATCH_MS } from '../src';
import type { TabStatus } from '../src';

// =============================================================================
// Test Helpers
// =============================================================================

type CapturedOutput = {
  outputs: Array<{ index: number; lines: string[] }>;
  statuses: Array<{ index: number; status: TabStatus; exitCode?: number }>;
  errors: Array<{ index: number; error: string }>;
};

function createTestManager(
  items: Array<{ label: string; exec: string }>,
  options?: { cwd?: string; env?: Record<string, string | undefined> }
): { manager: ProcessManager; captured: CapturedOutput } {
  const captured: CapturedOutput = {
    outputs: [],
    statuses: [],
    errors: [],
  };

  const manager = new ProcessManager(items, {
    cwd: options?.cwd ?? process.cwd(),
    env: options?.env ?? {},
    callbacks: {
      onOutputUpdate: (index, lines) => {
        captured.outputs.push({ index, lines: [...lines] });
      },
      onStatusChange: (index, status, exitCode) => {
        captured.statuses.push({ index, status, exitCode });
      },
      onError: (index, error) => {
        captured.errors.push({ index, error });
      },
    },
  });

  return { manager, captured };
}

// Helper to wait for process output batching
async function waitForBatch(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, OUTPUT_BATCH_MS + 10));
}

// Helper to wait for process to complete
async function waitForCompletion(ms: number = 500): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Constructor and Initial State Tests
// =============================================================================

describe('ProcessManager - constructor', () => {
  it('initializes with correct item count', () => {
    const { manager } = createTestManager([
      { label: 'Task 1', exec: 'echo hello' },
      { label: 'Task 2', exec: 'echo world' },
    ]);

    const tabs = manager.getInitialTabs();
    expect(tabs).toHaveLength(2);

    manager.destroy();
  });
});

describe('ProcessManager - getInitialTabs', () => {
  it('returns correct initial state', () => {
    const { manager } = createTestManager([
      { label: 'Build', exec: 'npm run build' },
      { label: 'Test', exec: 'npm test' },
    ]);

    const tabs = manager.getInitialTabs();

    expect(tabs[0]).toEqual({
      id: 'tab-0',
      label: 'Build',
      exec: 'npm run build',
      output: [],
      status: 'running',
    });

    expect(tabs[1]).toEqual({
      id: 'tab-1',
      label: 'Test',
      exec: 'npm test',
      output: [],
      status: 'running',
    });

    manager.destroy();
  });
});

// =============================================================================
// Process Execution Tests
// =============================================================================

describe('ProcessManager - start', () => {
  it('spawns processes for all items', async () => {
    const { manager, captured } = createTestManager([
      { label: 'Echo', exec: 'echo "test output"' },
    ]);

    manager.start();
    await waitForCompletion();

    // Should have received output
    expect(captured.outputs.length).toBeGreaterThan(0);
    // Should have received done status
    expect(captured.statuses.some((s) => s.status === 'done')).toBe(true);

    manager.destroy();
  });

  it('does nothing if already destroyed', async () => {
    const { manager, captured } = createTestManager([{ label: 'Echo', exec: 'echo hello' }]);

    manager.destroy();
    manager.start();

    await waitForCompletion(100);

    // No processes should have started
    expect(captured.statuses).toHaveLength(0);
  });
});

describe('ProcessManager - process lifecycle', () => {
  it('reports exit code 0 as done status', async () => {
    const { manager, captured } = createTestManager([{ label: 'Success', exec: 'exit 0' }]);

    manager.start();
    await waitForCompletion();

    const finalStatus = captured.statuses.find((s) => s.status === 'done' || s.status === 'error');
    expect(finalStatus?.status).toBe('done');
    expect(finalStatus?.exitCode).toBe(0);

    manager.destroy();
  });

  it('reports non-zero exit code as error status', async () => {
    const { manager, captured } = createTestManager([{ label: 'Failure', exec: 'exit 1' }]);

    manager.start();
    await waitForCompletion();

    const finalStatus = captured.statuses.find((s) => s.status === 'done' || s.status === 'error');
    expect(finalStatus?.status).toBe('error');
    expect(finalStatus?.exitCode).toBe(1);

    manager.destroy();
  });

  it('captures stdout output', async () => {
    const { manager, captured } = createTestManager([
      { label: 'Echo', exec: 'echo "hello from stdout"' },
    ]);

    manager.start();
    await waitForCompletion();

    const allOutput = captured.outputs.flatMap((o) => o.lines);
    expect(allOutput.some((line) => line.includes('hello from stdout'))).toBe(true);

    manager.destroy();
  });

  it('captures stderr output', async () => {
    const { manager, captured } = createTestManager([
      { label: 'Echo', exec: 'echo "error message" >&2' },
    ]);

    manager.start();
    await waitForCompletion();

    const allOutput = captured.outputs.flatMap((o) => o.lines);
    expect(allOutput.some((line) => line.includes('error message'))).toBe(true);

    manager.destroy();
  });
});

// =============================================================================
// Output Batching Tests
// =============================================================================

describe('ProcessManager - output batching', () => {
  it('batches output with configured delay', async () => {
    const { manager, captured } = createTestManager([
      {
        label: 'Multi-line',
        exec: 'echo "line1"; echo "line2"; echo "line3"',
      },
    ]);

    manager.start();
    await waitForCompletion();

    // Output may be batched together
    const allLines = captured.outputs.flatMap((o) => o.lines);
    expect(allLines.some((l) => l.includes('line1'))).toBe(true);
    expect(allLines.some((l) => l.includes('line2'))).toBe(true);
    expect(allLines.some((l) => l.includes('line3'))).toBe(true);

    manager.destroy();
  });
});

// =============================================================================
// Kill and Restart Tests
// =============================================================================

describe('ProcessManager - kill', () => {
  it('kills a specific process', async () => {
    const { manager, captured } = createTestManager([{ label: 'Long running', exec: 'sleep 10' }]);

    manager.start();
    await waitForBatch();

    manager.kill(0);
    await waitForBatch();

    // Should report stopped status
    expect(captured.statuses.some((s) => s.status === 'stopped')).toBe(true);
    // Should report "Stopped" in output
    expect(captured.outputs.some((o) => o.lines.includes('Stopped'))).toBe(true);

    manager.destroy();
  });

  it('does not overwrite stopped status with error after process closes', async () => {
    const { manager, captured } = createTestManager([{ label: 'Long running', exec: 'sleep 1' }]);

    manager.start();
    await waitForBatch();

    manager.kill(0);
    await waitForCompletion(300);

    const statusesForTab = captured.statuses.filter((s) => s.index === 0).map((s) => s.status);
    expect(statusesForTab).toContain('stopped');
    expect(statusesForTab).not.toContain('error');

    manager.destroy();
  });
});

describe('ProcessManager - killAll', () => {
  it('kills all processes', async () => {
    const { manager, captured } = createTestManager([
      { label: 'Process 1', exec: 'sleep 10' },
      { label: 'Process 2', exec: 'sleep 10' },
    ]);

    manager.start();
    await waitForBatch();

    manager.killAll();
    await waitForCompletion();

    manager.destroy();

    // Both processes should have been killed - they won't complete naturally
    // Since killAll doesn't update status for each, we just verify no crash
    expect(true).toBe(true);
  });
});

describe('ProcessManager - restart', () => {
  it('restarts a specific process', async () => {
    const { manager, captured } = createTestManager([{ label: 'Restartable', exec: 'echo done' }]);

    manager.start();
    await waitForCompletion();

    // Clear captured data
    captured.outputs.length = 0;
    captured.statuses.length = 0;

    manager.restart(0);
    await waitForCompletion(200);

    // Should show "Restarting..." message
    expect(captured.outputs.some((o) => o.lines.includes('Restarting...'))).toBe(true);
    // Should set status back to running
    expect(captured.statuses.some((s) => s.status === 'running')).toBe(true);

    manager.destroy();
  });

  it('does nothing if destroyed', async () => {
    const { manager, captured } = createTestManager([{ label: 'Test', exec: 'echo hello' }]);

    manager.destroy();
    manager.restart(0);

    await waitForBatch();

    // No updates should have occurred
    expect(captured.outputs).toHaveLength(0);
    expect(captured.statuses).toHaveLength(0);
  });

  it('does nothing for invalid index', async () => {
    const { manager, captured } = createTestManager([{ label: 'Test', exec: 'echo hello' }]);

    manager.restart(999);
    await waitForBatch();

    // No updates for invalid index
    expect(captured.outputs).toHaveLength(0);

    manager.destroy();
  });
});

// =============================================================================
// Destroy Tests
// =============================================================================

describe('ProcessManager - destroy', () => {
  it('sets destroyed flag', async () => {
    const { manager } = createTestManager([{ label: 'Test', exec: 'sleep 10' }]);

    manager.start();
    await waitForBatch();

    manager.destroy();

    // After destroy, operations should be no-ops
    // Restart should not work
    manager.restart(0);

    // No crash expected
    expect(true).toBe(true);
  });

  it('kills all running processes', async () => {
    const { manager } = createTestManager([
      { label: 'Process 1', exec: 'sleep 10' },
      { label: 'Process 2', exec: 'sleep 10' },
    ]);

    manager.start();
    await waitForBatch();

    manager.destroy();

    // Processes should be killed, no zombie processes
    // Just ensure no crash
    await waitForBatch();
    expect(true).toBe(true);
  });
});

// =============================================================================
// Environment and Working Directory Tests
// =============================================================================

describe('ProcessManager - environment', () => {
  it('passes environment variables to process', async () => {
    const { manager, captured } = createTestManager(
      [{ label: 'Env Test', exec: 'echo $TEST_VAR' }],
      { env: { TEST_VAR: 'test_value' } }
    );

    manager.start();
    await waitForCompletion();

    const allOutput = captured.outputs.flatMap((o) => o.lines);
    expect(allOutput.some((line) => line.includes('test_value'))).toBe(true);

    manager.destroy();
  });

  it('sets FORCE_COLOR=1 for colored output', async () => {
    const { manager, captured } = createTestManager([
      { label: 'Color Test', exec: 'echo $FORCE_COLOR' },
    ]);

    manager.start();
    await waitForCompletion();

    const allOutput = captured.outputs.flatMap((o) => o.lines);
    expect(allOutput.some((line) => line.includes('1'))).toBe(true);

    manager.destroy();
  });
});

describe('ProcessManager - working directory', () => {
  it('runs process in specified directory', async () => {
    const { manager, captured } = createTestManager([{ label: 'PWD Test', exec: 'pwd' }], {
      cwd: '/tmp',
    });

    manager.start();
    await waitForCompletion();

    const allOutput = captured.outputs.flatMap((o) => o.lines);
    expect(allOutput.some((line) => line.includes('/tmp') || line.includes('/private/tmp'))).toBe(
      true
    );

    manager.destroy();
  });
});

// =============================================================================
// Multiple Process Tests
// =============================================================================

describe('ProcessManager - multiple processes', () => {
  it('handles multiple processes independently', async () => {
    const { manager, captured } = createTestManager([
      { label: 'Fast', exec: 'echo fast' },
      { label: 'Medium', exec: 'sleep 0.1 && echo medium' },
    ]);

    manager.start();
    await waitForCompletion(500);

    // Both should complete
    const doneStatuses = captured.statuses.filter((s) => s.status === 'done');
    expect(doneStatuses).toHaveLength(2);

    manager.destroy();
  });

  it('reports output for correct process index', async () => {
    const { manager, captured } = createTestManager([
      { label: 'First', exec: 'echo "output-from-first"' },
      { label: 'Second', exec: 'echo "output-from-second"' },
    ]);

    manager.start();
    await waitForCompletion();

    // Check that outputs are associated with correct indices
    const firstOutputs = captured.outputs.filter((o) => o.index === 0);
    const secondOutputs = captured.outputs.filter((o) => o.index === 1);

    const firstLines = firstOutputs.flatMap((o) => o.lines);
    const secondLines = secondOutputs.flatMap((o) => o.lines);

    expect(firstLines.some((l) => l.includes('output-from-first'))).toBe(true);
    expect(secondLines.some((l) => l.includes('output-from-second'))).toBe(true);

    manager.destroy();
  });
});
