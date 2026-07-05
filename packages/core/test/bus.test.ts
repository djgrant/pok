import { describe, it, expect } from 'bun:test';
import { createEventBus } from '../src';
import type { CLIEvent } from '../src';

// =============================================================================
// createEventBus Tests
// =============================================================================

describe('createEventBus', () => {
  it('creates event bus with emit and on methods', () => {
    const bus = createEventBus();

    expect(typeof bus.emit).toBe('function');
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.subscribe).toBe('function');
  });
});

// =============================================================================
// EventBus.emit() Tests
// =============================================================================

describe('EventBus.emit()', () => {
  it('emits root:start event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({ type: 'root:start', appName: 'test-app', version: '1.0.0' });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('root:start');
    if (events[0].type === 'root:start') {
      expect(events[0].appName).toBe('test-app');
      expect(events[0].version).toBe('1.0.0');
    }
  });

  it('emits root:end event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({ type: 'root:end', exitCode: 0 });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('root:end');
    if (events[0].type === 'root:end') {
      expect(events[0].exitCode).toBe(0);
    }
  });

  it('emits group:start event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({
      type: 'group:start',
      id: 'group-1' as any,
      label: 'Test Group',
      layout: 'sequence',
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('group:start');
  });

  it('emits activity:start event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({
      type: 'activity:start',
      id: 'activity-1' as any,
      label: 'Running task',
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('activity:start');
  });

  it('emits log event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({
      type: 'log',
      level: 'info',
      message: 'Test message',
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('log');
    if (events[0].type === 'log') {
      expect(events[0].level).toBe('info');
      expect(events[0].message).toBe('Test message');
    }
  });

  it('notifies all listeners', () => {
    const bus = createEventBus();
    const listener1Events: CLIEvent[] = [];
    const listener2Events: CLIEvent[] = [];

    bus.on((event) => listener1Events.push(event));
    bus.on((event) => listener2Events.push(event));

    bus.emit({ type: 'root:start', appName: 'test' });

    expect(listener1Events).toHaveLength(1);
    expect(listener2Events).toHaveLength(1);
  });

  it('notifies listeners in order of registration', () => {
    const bus = createEventBus();
    const order: number[] = [];

    bus.on(() => order.push(1));
    bus.on(() => order.push(2));
    bus.on(() => order.push(3));

    bus.emit({ type: 'root:start', appName: 'test' });

    expect(order).toEqual([1, 2, 3]);
  });
});

// =============================================================================
// EventBus.on() Tests
// =============================================================================

describe('EventBus.on()', () => {
  it('returns unsubscribe function', () => {
    const bus = createEventBus();

    const unsubscribe = bus.on(() => {});

    expect(typeof unsubscribe).toBe('function');
  });

  it('unsubscribe removes listener', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    const unsubscribe = bus.on((event) => events.push(event));

    bus.emit({ type: 'root:start', appName: 'test' });
    expect(events).toHaveLength(1);

    unsubscribe();

    bus.emit({ type: 'root:end', exitCode: 0 });
    expect(events).toHaveLength(1); // No new events
  });

  it('can unsubscribe multiple listeners independently', () => {
    const bus = createEventBus();
    const events1: CLIEvent[] = [];
    const events2: CLIEvent[] = [];

    const unsub1 = bus.on((event) => events1.push(event));
    const unsub2 = bus.on((event) => events2.push(event));

    bus.emit({ type: 'root:start', appName: 'test' });
    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);

    unsub1();

    bus.emit({ type: 'root:end', exitCode: 0 });
    expect(events1).toHaveLength(1); // Listener 1 unsubscribed
    expect(events2).toHaveLength(2); // Listener 2 still active

    unsub2();

    bus.emit({ type: 'log', level: 'info', message: 'test' });
    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(2); // Listener 2 also unsubscribed
  });

  it('handles adding listener during emit', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on(() => {
      // Add listener during emit
      bus.on((event) => events.push(event));
    });

    bus.emit({ type: 'root:start', appName: 'test' });

    // The new listener should receive subsequent events
    bus.emit({ type: 'root:end', exitCode: 0 });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// EventBus.subscribe() (Alias) Tests
// =============================================================================

describe('EventBus.subscribe() (alias)', () => {
  it('behaves like on() and returns unsubscribe', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    const unsubscribe = bus.subscribe((event) => events.push(event));
    expect(typeof unsubscribe).toBe('function');

    bus.emit({ type: 'root:start', appName: 'test' });
    expect(events).toHaveLength(1);

    unsubscribe();
    bus.emit({ type: 'root:end', exitCode: 0 });
    expect(events).toHaveLength(1);
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('EventBus error handling', () => {
  it('logs errors by default', () => {
    const bus = createEventBus();
    const originalError = console.error;
    const errors: unknown[] = [];
    console.error = (...args) => errors.push(args);

    bus.on(() => {
      throw new Error('Listener error');
    });

    bus.emit({ type: 'root:start', appName: 'test' });

    expect(errors.length).toBe(1);
    console.error = originalError;
  });

  it('continues to other listeners after error', () => {
    const bus = createEventBus();
    const originalError = console.error;
    console.error = () => {}; // Suppress error output

    const events: CLIEvent[] = [];

    bus.on(() => {
      throw new Error('First listener error');
    });
    bus.on((event) => events.push(event));

    bus.emit({ type: 'root:start', appName: 'test' });

    expect(events).toHaveLength(1);
    console.error = originalError;
  });
});

// =============================================================================
// Event Types Tests
// =============================================================================

describe('Event types', () => {
  it('handles activity:update event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({
      type: 'activity:update',
      id: 'activity-1' as any,
      payload: { progress: 50, message: 'Half done' },
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('activity:update');
  });

  it('handles activity:success event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({
      type: 'activity:success',
      id: 'activity-1' as any,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('activity:success');
  });

  it('handles activity:failure event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({
      type: 'activity:failure',
      id: 'activity-1' as any,
      error: new Error('Test failure'),
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('activity:failure');
  });

  it('handles group:end event', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));
    bus.emit({
      type: 'group:end',
      id: 'group-1' as any,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('group:end');
  });

  it('handles log event with different levels', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));

    bus.emit({ type: 'log', level: 'info', message: 'Info message' });
    bus.emit({ type: 'log', level: 'warn', message: 'Warning message' });
    bus.emit({ type: 'log', level: 'error', message: 'Error message' });
    bus.emit({ type: 'log', level: 'success', message: 'Success message' });
    bus.emit({ type: 'log', level: 'step', message: 'Step message' });

    expect(events).toHaveLength(5);
    const levels = events.map((e) => (e.type === 'log' ? e.level : null));
    expect(levels).toContain('info');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
    expect(levels).toContain('success');
    expect(levels).toContain('step');
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('EventBus integration', () => {
  it('supports full event lifecycle', () => {
    const bus = createEventBus();
    const events: CLIEvent[] = [];

    bus.on((event) => events.push(event));

    // Simulate a typical CLI run
    bus.emit({ type: 'root:start', appName: 'my-cli', version: '1.0.0' });
    bus.emit({ type: 'group:start', id: 'checks' as any, label: 'Pre-flight', layout: 'sequence' });
    bus.emit({
      type: 'activity:start',
      id: 'check-1' as any,
      label: 'Check A',
      parentId: 'checks' as any,
    });
    bus.emit({ type: 'activity:success', id: 'check-1' as any });
    bus.emit({ type: 'group:end', id: 'checks' as any });
    bus.emit({ type: 'root:end', exitCode: 0 });

    expect(events).toHaveLength(6);
    expect(events[0].type).toBe('root:start');
    expect(events[events.length - 1].type).toBe('root:end');
  });

  it('can be used with multiple independent buses', () => {
    const bus1 = createEventBus();
    const bus2 = createEventBus();

    const events1: CLIEvent[] = [];
    const events2: CLIEvent[] = [];

    bus1.on((event) => events1.push(event));
    bus2.on((event) => events2.push(event));

    bus1.emit({ type: 'root:start', appName: 'app1' });
    bus2.emit({ type: 'root:start', appName: 'app2' });

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);

    if (events1[0].type === 'root:start') {
      expect(events1[0].appName).toBe('app1');
    }
    if (events2[0].type === 'root:start') {
      expect(events2[0].appName).toBe('app2');
    }
  });
});
