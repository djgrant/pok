import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createEventBus, type CLIEvent } from '@pokit/core';

// =============================================================================
// Mock process TTY status for adapter TTY checks
// =============================================================================

// Save original values
const originalStdoutIsTTY = process.stdout.isTTY;
const originalStdinIsTTY = process.stdin.isTTY;

function mockTTY(stdout: boolean, stdin: boolean) {
  Object.defineProperty(process.stdout, 'isTTY', { value: stdout, configurable: true });
  Object.defineProperty(process.stdin, 'isTTY', { value: stdin, configurable: true });
}

function restoreTTY() {
  Object.defineProperty(process.stdout, 'isTTY', {
    value: originalStdoutIsTTY,
    configurable: true,
  });
  Object.defineProperty(process.stdin, 'isTTY', {
    value: originalStdinIsTTY,
    configurable: true,
  });
}

// =============================================================================
// Test Adapter Exports
// =============================================================================

describe('@pokit/opentui - exports', () => {
  it('exports createTabsAdapter function', async () => {
    const module = await import('@pokit/opentui');
    expect(typeof module.createTabsAdapter).toBe('function');
  });

  it('exports createEventAdapter function', async () => {
    const module = await import('@pokit/opentui');
    expect(typeof module.createEventAdapter).toBe('function');
  });
});

// =============================================================================
// createTabsAdapter Tests
// =============================================================================

describe('createTabsAdapter', () => {
  let adapter: ReturnType<typeof import('@pokit/opentui').createTabsAdapter>;

  beforeEach(async () => {
    const { createTabsAdapter } = await import('@pokit/opentui');
    adapter = createTabsAdapter();
  });

  afterEach(() => {
    restoreTTY();
  });

  it('returns adapter with run method', () => {
    expect(typeof adapter.run).toBe('function');
  });

  it('throws error when stdout is not TTY', async () => {
    mockTTY(false, true);

    await expect(
      adapter.run([{ label: 'test', exec: 'echo test' }], { name: 'test', cwd: '/tmp', env: {} })
    ).rejects.toThrow('stdout to be a TTY');
  });

  it('throws error when stdin is not TTY', async () => {
    mockTTY(true, false);

    await expect(
      adapter.run([{ label: 'test', exec: 'echo test' }], { name: 'test', cwd: '/tmp', env: {} })
    ).rejects.toThrow('stdin to be a TTY');
  });

  it('returns immediately for empty items array', async () => {
    mockTTY(true, true);

    // Empty items should return immediately without throwing
    const result = await adapter.run([], { name: 'test', cwd: '/tmp', env: {} });
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// createEventAdapter Tests
// =============================================================================

describe('createEventAdapter', () => {
  afterEach(() => {
    restoreTTY();
  });

  it('throws error when stdout is not TTY', async () => {
    mockTTY(false, true);
    const { createEventAdapter } = await import('@pokit/opentui');
    const bus = createEventBus();

    expect(() => createEventAdapter(bus)).toThrow('stdout to be a TTY');
  });

  it('throws error when stdin is not TTY', async () => {
    mockTTY(true, false);
    const { createEventAdapter } = await import('@pokit/opentui');
    const bus = createEventBus();

    expect(() => createEventAdapter(bus)).toThrow('stdin to be a TTY');
  });
});

// =============================================================================
// Test App Adapter Exports
// =============================================================================

describe('@pokit/opentui - app adapter exports', () => {
  it('exports createAppAdapter function', async () => {
    const module = await import('@pokit/opentui');
    expect(typeof module.createAppAdapter).toBe('function');
  });
});

// =============================================================================
// createAppAdapter Tests
// =============================================================================

describe('createAppAdapter', () => {
  let adapter: ReturnType<typeof import('@pokit/opentui').createAppAdapter>;

  beforeEach(async () => {
    const { createAppAdapter } = await import('@pokit/opentui');
    adapter = createAppAdapter();
  });

  afterEach(() => {
    restoreTTY();
  });

  it('returns adapter with run method', () => {
    expect(typeof adapter.run).toBe('function');
  });

  it('throws error when stdout is not TTY', async () => {
    mockTTY(false, true);

    const DummyApp = () => null;
    await expect(adapter.run(DummyApp, {})).rejects.toThrow('stdout to be a TTY');
  });

  it('throws error when stdin is not TTY', async () => {
    mockTTY(true, false);

    const DummyApp = () => null;
    await expect(adapter.run(DummyApp, {})).rejects.toThrow('stdin to be a TTY');
  });
});

// =============================================================================
// EventBus Integration Tests
// =============================================================================

describe('EventBus integration', () => {
  it('event bus can emit and receive events', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));

    bus.emit({ type: 'root:start', appName: 'test', version: '1.0.0' });
    bus.emit({ type: 'root:end', exitCode: 0 });

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('root:start');
    expect(events[1].type).toBe('root:end');
  });

  it('unsubscribe removes listener', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    const unsubscribe = bus.on((event) => events.push(event));

    bus.emit({ type: 'root:start', appName: 'test' });
    expect(events).toHaveLength(1);

    unsubscribe();

    bus.emit({ type: 'root:end', exitCode: 0 });
    expect(events).toHaveLength(1); // No new events added
  });
});
