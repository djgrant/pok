import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import { createEventBus, type CLIEvent, type EventBus } from '@pokit/core';

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

describe('@pokit/tabs-ink - exports', () => {
  it('exports createTabsAdapter function', async () => {
    const module = await import('@pokit/tabs-ink');
    expect(typeof module.createTabsAdapter).toBe('function');
  });

  it('exports createEventAdapter function', async () => {
    const module = await import('@pokit/tabs-ink');
    expect(typeof module.createEventAdapter).toBe('function');
  });

  it('exports useEventBus hook', async () => {
    const module = await import('@pokit/tabs-ink');
    expect(typeof module.useEventBus).toBe('function');
  });

  it('re-exports state management from tabs-core', async () => {
    const module = await import('@pokit/tabs-ink');
    expect(typeof module.createInitialState).toBe('function');
    expect(typeof module.reducer).toBe('function');
    expect(typeof module.getTabsGroupActivities).toBe('function');
    expect(typeof module.findTabsGroup).toBe('function');
  });
});

// =============================================================================
// createTabsAdapter Tests
// =============================================================================

describe('createTabsAdapter', () => {
  let adapter: ReturnType<typeof import('@pokit/tabs-ink').createTabsAdapter>;

  beforeEach(async () => {
    const { createTabsAdapter } = await import('@pokit/tabs-ink');
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
    const { createEventAdapter } = await import('@pokit/tabs-ink');
    const bus = createEventBus();

    expect(() => createEventAdapter(bus)).toThrow('stdout to be a TTY');
  });

  it('throws error when stdin is not TTY', async () => {
    mockTTY(true, false);
    const { createEventAdapter } = await import('@pokit/tabs-ink');
    const bus = createEventBus();

    expect(() => createEventAdapter(bus)).toThrow('stdin to be a TTY');
  });
});

// =============================================================================
// State Management (re-exported from tabs-core)
// =============================================================================

describe('State management re-exports', () => {
  it('createInitialState creates empty state', async () => {
    const { createInitialState } = await import('@pokit/tabs-ink');
    const state = createInitialState();

    expect(state.appName).toBeUndefined();
    expect(state.version).toBeUndefined();
    expect(state.exitCode).toBeUndefined();
    expect(state.activities).toBeInstanceOf(Map);
    expect(state.groups).toBeInstanceOf(Map);
    expect(state.rootChildren).toEqual([]);
  });

  it('reducer handles root:start event', async () => {
    const { createInitialState, reducer } = await import('@pokit/tabs-ink');
    const state = createInitialState();

    const event: CLIEvent = {
      type: 'root:start',
      appName: 'test-app',
      version: '1.0.0',
    };

    const newState = reducer(state, event);

    expect(newState.appName).toBe('test-app');
    expect(newState.version).toBe('1.0.0');
  });

  it('reducer handles group:start event', async () => {
    const { createInitialState, reducer } = await import('@pokit/tabs-ink');
    const state = createInitialState();

    const event: CLIEvent = {
      type: 'group:start',
      id: 'group-1' as any,
      label: 'Test Group',
      layout: 'tabs',
    };

    const newState = reducer(state, event);

    expect(newState.groups.has('group-1')).toBe(true);
    expect(newState.groups.get('group-1')?.label).toBe('Test Group');
    expect(newState.groups.get('group-1')?.layout).toBe('tabs');
  });

  it('findTabsGroup finds tabs layout group', async () => {
    const { createInitialState, reducer, findTabsGroup } = await import('@pokit/tabs-ink');

    let state = createInitialState();
    state = reducer(state, {
      type: 'group:start',
      id: 'seq-group' as any,
      label: 'Sequential',
      layout: 'sequence',
    });
    state = reducer(state, {
      type: 'group:start',
      id: 'tabs-group' as any,
      label: 'Tabbed',
      layout: 'tabs',
    });

    const tabsGroup = findTabsGroup(state);

    expect(tabsGroup).toBeDefined();
    expect(tabsGroup?.layout).toBe('tabs');
    expect(tabsGroup?.label).toBe('Tabbed');
  });

  it('getTabsGroupActivities returns activities in tabs group', async () => {
    const { createInitialState, reducer, getTabsGroupActivities } = await import('@pokit/tabs-ink');

    let state = createInitialState();
    const groupId = 'tabs-group' as any;

    state = reducer(state, {
      type: 'group:start',
      id: groupId,
      label: 'Tabbed',
      layout: 'tabs',
    });
    state = reducer(state, {
      type: 'activity:start',
      id: 'activity-1' as any,
      parentId: groupId,
      label: 'Activity 1',
    });
    state = reducer(state, {
      type: 'activity:start',
      id: 'activity-2' as any,
      parentId: groupId,
      label: 'Activity 2',
    });

    const activities = getTabsGroupActivities(state, groupId);

    expect(activities).toHaveLength(2);
    expect(activities[0].label).toBe('Activity 1');
    expect(activities[1].label).toBe('Activity 2');
  });
});

// =============================================================================
// useEventBus Hook Tests (Unit tests without React rendering)
// =============================================================================

describe('useEventBus hook', () => {
  it('is exported as a function', async () => {
    const { useEventBus } = await import('@pokit/tabs-ink');
    expect(typeof useEventBus).toBe('function');
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
