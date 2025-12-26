import { describe, it, expect, mock } from 'bun:test';
import { RingBuffer, OutputBuffer } from '@openpok/tabs-core';

// =============================================================================
// RingBuffer Tests
// =============================================================================

describe('RingBuffer - constructor', () => {
  it('creates buffer with specified capacity', () => {
    const buffer = new RingBuffer<string>({ capacity: 100 });
    expect(buffer.length).toBe(0);
    expect(buffer.isFull).toBe(false);
  });

  it('uses default warn percentage of 80', () => {
    const onPressure = mock(() => {});
    const buffer = new RingBuffer<string>({ capacity: 10, onPressure });

    // Push 7 items (70%) - no warning
    for (let i = 0; i < 7; i++) buffer.push(`item-${i}`);
    expect(onPressure).not.toHaveBeenCalled();

    // Push 1 more (80%) - triggers warning
    buffer.push('item-7');
    expect(onPressure).toHaveBeenCalledTimes(1);
  });
});

describe('RingBuffer - push', () => {
  it('adds items to buffer', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });

    buffer.push('a');
    buffer.push('b');
    buffer.push('c');

    expect(buffer.length).toBe(3);
    expect(buffer.toArray()).toEqual(['a', 'b', 'c']);
  });

  it('returns false when no item is dropped', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });

    expect(buffer.push('a')).toBe(false);
    expect(buffer.push('b')).toBe(false);
  });

  it('returns true when item is dropped (buffer full)', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });

    buffer.push('a');
    buffer.push('b');
    buffer.push('c');

    expect(buffer.push('d')).toBe(true);
    expect(buffer.droppedCount).toBe(1);
  });

  it('maintains FIFO order when overwriting', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });

    buffer.push('a');
    buffer.push('b');
    buffer.push('c');
    buffer.push('d');
    buffer.push('e');

    expect(buffer.toArray()).toEqual(['c', 'd', 'e']);
    expect(buffer.droppedCount).toBe(2);
  });

  it('truncates long strings when maxLineLength is set', () => {
    const buffer = new RingBuffer<string>({ capacity: 10, maxLineLength: 5 });

    buffer.push('hello world');
    const result = buffer.toArray();

    expect(result[0]).toBe('hello…');
  });

  it('does not truncate strings shorter than maxLineLength', () => {
    const buffer = new RingBuffer<string>({ capacity: 10, maxLineLength: 20 });

    buffer.push('hello');
    const result = buffer.toArray();

    expect(result[0]).toBe('hello');
  });
});

describe('RingBuffer - pushMany', () => {
  it('pushes multiple items', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });

    buffer.pushMany(['a', 'b', 'c']);

    expect(buffer.length).toBe(3);
    expect(buffer.toArray()).toEqual(['a', 'b', 'c']);
  });

  it('returns count of dropped items', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });

    buffer.pushMany(['a', 'b']);
    const dropped = buffer.pushMany(['c', 'd', 'e']);

    expect(dropped).toBe(2);
    expect(buffer.droppedCount).toBe(2);
  });
});

describe('RingBuffer - length and usagePercentage', () => {
  it('tracks length correctly', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });

    expect(buffer.length).toBe(0);
    buffer.push('a');
    expect(buffer.length).toBe(1);
    buffer.push('b');
    expect(buffer.length).toBe(2);
  });

  it('length caps at capacity', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });

    buffer.pushMany(['a', 'b', 'c', 'd', 'e']);

    expect(buffer.length).toBe(3);
  });

  it('calculates usage percentage correctly', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });

    buffer.pushMany(['a', 'b', 'c', 'd', 'e']);
    expect(buffer.usagePercentage).toBe(50);

    buffer.pushMany(['f', 'g', 'h', 'i', 'j']);
    expect(buffer.usagePercentage).toBe(100);
  });
});

describe('RingBuffer - isFull', () => {
  it('returns false when not at capacity', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    buffer.pushMany(['a', 'b', 'c']);
    expect(buffer.isFull).toBe(false);
  });

  it('returns true when at capacity', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });
    buffer.pushMany(['a', 'b', 'c']);
    expect(buffer.isFull).toBe(true);
  });
});

describe('RingBuffer - clear', () => {
  it('resets buffer state', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });

    buffer.pushMany(['a', 'b', 'c']);
    buffer.clear();

    expect(buffer.length).toBe(0);
    expect(buffer.droppedCount).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });

  it('resets warning flag', () => {
    const onPressure = mock(() => {});
    const buffer = new RingBuffer<string>({ capacity: 10, warnAtPercentage: 50, onPressure });

    buffer.pushMany(['1', '2', '3', '4', '5', '6']); // 60% - triggers warning
    expect(onPressure).toHaveBeenCalledTimes(1);

    buffer.clear();
    buffer.pushMany(['1', '2', '3', '4', '5', '6']); // Should trigger again
    expect(onPressure).toHaveBeenCalledTimes(2);
  });
});

describe('RingBuffer - toArray', () => {
  it('returns empty array for empty buffer', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    expect(buffer.toArray()).toEqual([]);
  });

  it('returns items in correct order before full', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    buffer.pushMany(['a', 'b', 'c']);
    expect(buffer.toArray()).toEqual(['a', 'b', 'c']);
  });

  it('returns items in correct order after wrapping', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });
    buffer.pushMany(['a', 'b', 'c', 'd', 'e']);
    expect(buffer.toArray()).toEqual(['c', 'd', 'e']);
  });

  it('handles multiple wraps correctly', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });

    // Fill and wrap multiple times
    for (let i = 0; i < 10; i++) {
      buffer.push(`item-${i}`);
    }

    expect(buffer.toArray()).toEqual(['item-7', 'item-8', 'item-9']);
    expect(buffer.droppedCount).toBe(7);
  });
});

describe('RingBuffer - get', () => {
  it('returns item at index', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    buffer.pushMany(['a', 'b', 'c']);

    expect(buffer.get(0)).toBe('a');
    expect(buffer.get(1)).toBe('b');
    expect(buffer.get(2)).toBe('c');
  });

  it('returns undefined for invalid indices', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    buffer.pushMany(['a', 'b', 'c']);

    expect(buffer.get(-1)).toBeUndefined();
    expect(buffer.get(3)).toBeUndefined();
    expect(buffer.get(100)).toBeUndefined();
  });

  it('returns correct item after wrapping', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });
    buffer.pushMany(['a', 'b', 'c', 'd', 'e']);

    expect(buffer.get(0)).toBe('c'); // oldest
    expect(buffer.get(1)).toBe('d');
    expect(buffer.get(2)).toBe('e'); // newest
  });
});

describe('RingBuffer - slice', () => {
  it('returns slice of items', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    buffer.pushMany(['a', 'b', 'c', 'd', 'e']);

    expect(buffer.slice(1, 4)).toEqual(['b', 'c', 'd']);
  });

  it('handles missing end parameter', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    buffer.pushMany(['a', 'b', 'c', 'd', 'e']);

    expect(buffer.slice(2)).toEqual(['c', 'd', 'e']);
  });

  it('handles out of bounds indices', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    buffer.pushMany(['a', 'b', 'c']);

    expect(buffer.slice(-5, 100)).toEqual(['a', 'b', 'c']);
    expect(buffer.slice(5, 10)).toEqual([]);
  });

  it('works after wrapping', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });
    buffer.pushMany(['a', 'b', 'c', 'd', 'e']);

    expect(buffer.slice(0, 2)).toEqual(['c', 'd']);
  });
});

describe('RingBuffer - pressure warnings', () => {
  it('calls onPressure when threshold reached', () => {
    const onPressure = mock(() => {});
    const buffer = new RingBuffer<string>({
      capacity: 10,
      warnAtPercentage: 50,
      onPressure,
    });

    buffer.pushMany(['1', '2', '3', '4']); // 40%
    expect(onPressure).not.toHaveBeenCalled();

    buffer.push('5'); // 50%
    expect(onPressure).toHaveBeenCalledTimes(1);
    expect(onPressure).toHaveBeenCalledWith(50);
  });

  it('only emits warning once until reset', () => {
    const onPressure = mock(() => {});
    const buffer = new RingBuffer<string>({
      capacity: 10,
      warnAtPercentage: 50,
      onPressure,
    });

    buffer.pushMany(['1', '2', '3', '4', '5']); // 50% - triggers
    buffer.pushMany(['6', '7', '8', '9', '10']); // 100% - no second trigger

    expect(onPressure).toHaveBeenCalledTimes(1);
  });

  it('emits again after resetWarning', () => {
    const onPressure = mock(() => {});
    const buffer = new RingBuffer<string>({
      capacity: 10,
      warnAtPercentage: 50,
      onPressure,
    });

    buffer.pushMany(['1', '2', '3', '4', '5']); // triggers
    expect(onPressure).toHaveBeenCalledTimes(1);

    buffer.resetWarning();
    buffer.push('6'); // triggers again since still above threshold
    expect(onPressure).toHaveBeenCalledTimes(2);
  });
});

describe('RingBuffer - droppedCount', () => {
  it('starts at zero', () => {
    const buffer = new RingBuffer<string>({ capacity: 10 });
    expect(buffer.droppedCount).toBe(0);
  });

  it('increments when items are dropped', () => {
    const buffer = new RingBuffer<string>({ capacity: 3 });

    buffer.pushMany(['a', 'b', 'c']);
    expect(buffer.droppedCount).toBe(0);

    buffer.push('d');
    expect(buffer.droppedCount).toBe(1);

    buffer.push('e');
    expect(buffer.droppedCount).toBe(2);
  });
});

// =============================================================================
// OutputBuffer Tests
// =============================================================================

describe('OutputBuffer - constructor', () => {
  it('creates with default options', () => {
    const buffer = new OutputBuffer();
    expect(buffer.length).toBe(0);
  });

  it('accepts custom options', () => {
    const onPressure = mock(() => {});
    const buffer = new OutputBuffer({
      maxLines: 100,
      maxLineLength: 50,
      warnAtPercentage: 60,
      onPressure,
      tabId: 'test-tab',
    });
    expect(buffer.length).toBe(0);
  });
});

describe('OutputBuffer - push', () => {
  it('pushes lines into buffer', () => {
    const buffer = new OutputBuffer({ maxLines: 100 });

    buffer.push('line1', 'line2', 'line3');

    expect(buffer.length).toBe(3);
    expect(buffer.toArrayRaw()).toEqual(['line1', 'line2', 'line3']);
  });
});

describe('OutputBuffer - toArray with dropped indicator', () => {
  it('returns lines without indicator when no lines dropped', () => {
    const buffer = new OutputBuffer({ maxLines: 100 });

    buffer.push('line1', 'line2');

    expect(buffer.toArray()).toEqual(['line1', 'line2']);
  });

  it('includes dropped indicator when lines are dropped', () => {
    const buffer = new OutputBuffer({ maxLines: 3 });

    buffer.push('line1', 'line2', 'line3', 'line4', 'line5');

    const result = buffer.toArray();
    expect(result[0]).toBe('... (2 lines dropped) ...');
    expect(result.slice(1)).toEqual(['line3', 'line4', 'line5']);
  });

  it('formats large dropped counts with locale string', () => {
    const buffer = new OutputBuffer({ maxLines: 3 });

    // Push 1003 lines total
    for (let i = 0; i < 1003; i++) {
      buffer.push(`line-${i}`);
    }

    const result = buffer.toArray();
    // Should have 1000 dropped, formatted with commas
    expect(result[0]).toContain('1,000');
  });
});

describe('OutputBuffer - toArrayRaw', () => {
  it('returns lines without dropped indicator', () => {
    const buffer = new OutputBuffer({ maxLines: 3 });

    buffer.push('line1', 'line2', 'line3', 'line4', 'line5');

    expect(buffer.toArrayRaw()).toEqual(['line3', 'line4', 'line5']);
  });
});

describe('OutputBuffer - clear', () => {
  it('clears all data', () => {
    const buffer = new OutputBuffer({ maxLines: 3 });

    buffer.push('line1', 'line2', 'line3', 'line4');
    buffer.clear();

    expect(buffer.length).toBe(0);
    expect(buffer.droppedCount).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });
});

describe('OutputBuffer - pressure callback', () => {
  it('calls onPressure with tabId', () => {
    const onPressure = mock(() => {});
    const buffer = new OutputBuffer({
      maxLines: 10,
      warnAtPercentage: 50,
      onPressure,
      tabId: 'my-tab',
    });

    buffer.push('1', '2', '3', '4', '5');

    expect(onPressure).toHaveBeenCalledWith('my-tab', 50);
  });
});

describe('OutputBuffer - usagePercentage and isFull', () => {
  it('exposes underlying buffer properties', () => {
    const buffer = new OutputBuffer({ maxLines: 10 });

    buffer.push('1', '2', '3', '4', '5');
    expect(buffer.usagePercentage).toBe(50);
    expect(buffer.isFull).toBe(false);

    buffer.push('6', '7', '8', '9', '10');
    expect(buffer.usagePercentage).toBe(100);
    expect(buffer.isFull).toBe(true);
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('RingBuffer - O(1) performance', () => {
  it('push is O(1) regardless of buffer size', () => {
    const smallBuffer = new RingBuffer<number>({ capacity: 100 });
    const largeBuffer = new RingBuffer<number>({ capacity: 100_000 });

    // Time small buffer operations
    const smallStart = performance.now();
    for (let i = 0; i < 10_000; i++) {
      smallBuffer.push(i);
    }
    const smallTime = performance.now() - smallStart;

    // Time large buffer operations
    const largeStart = performance.now();
    for (let i = 0; i < 10_000; i++) {
      largeBuffer.push(i);
    }
    const largeTime = performance.now() - largeStart;

    // Times should be within same order of magnitude
    // Allow 5x variance for test stability
    expect(largeTime).toBeLessThan(smallTime * 5 + 10); // +10ms buffer
  });

  it('handles 10,000 lines efficiently', () => {
    const buffer = new RingBuffer<string>({ capacity: 10_000 });

    const start = performance.now();
    for (let i = 0; i < 15_000; i++) {
      buffer.push(`This is line number ${i} with some content`);
    }
    const pushTime = performance.now() - start;

    const toArrayStart = performance.now();
    const arr = buffer.toArray();
    const toArrayTime = performance.now() - toArrayStart;

    // Push should be very fast (< 100ms for 15000 operations)
    expect(pushTime).toBeLessThan(100);
    // toArray is O(n) but should still be reasonable
    expect(toArrayTime).toBeLessThan(50);
    expect(arr.length).toBe(10_000);
    expect(buffer.droppedCount).toBe(5_000);
  });
});
