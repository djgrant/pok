/**
 * Ring Buffer Implementation
 *
 * A fixed-capacity circular buffer with O(1) push operations.
 * When full, oldest elements are automatically overwritten.
 *
 * Key features:
 * - O(1) push operations (no array shifting)
 * - Configurable capacity with buffer pressure warnings
 * - Track number of dropped items
 * - Dropped line indicator support
 */

// =============================================================================
// Types
// =============================================================================

export type RingBufferOptions = {
  /** Maximum number of items to store */
  capacity: number;
  /** Maximum length of each line (truncate longer lines) */
  maxLineLength?: number;
  /** Percentage (0-100) at which to trigger pressure warning */
  warnAtPercentage?: number;
  /** Callback when buffer pressure threshold is reached */
  onPressure?: (usage: number) => void;
};

// =============================================================================
// RingBuffer Class
// =============================================================================

/**
 * A circular buffer that overwrites oldest items when full.
 * All operations are O(1) except toArray() which is O(n).
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0; // Points to next write position
  private _length = 0;
  private readonly capacity: number;
  private readonly maxLineLength?: number;
  private readonly warnAtPercentage: number;
  private readonly onPressure?: (usage: number) => void;
  private _droppedCount = 0;
  private warningEmitted = false;

  constructor(options: RingBufferOptions) {
    this.capacity = options.capacity;
    this.maxLineLength = options.maxLineLength;
    this.warnAtPercentage = options.warnAtPercentage ?? 80;
    this.onPressure = options.onPressure;
    this.buffer = new Array(this.capacity);
  }

  /**
   * Number of items currently in the buffer
   */
  get length(): number {
    return this._length;
  }

  /**
   * Number of items that have been dropped due to capacity limits
   */
  get droppedCount(): number {
    return this._droppedCount;
  }

  /**
   * Current buffer usage as a percentage (0-100)
   */
  get usagePercentage(): number {
    return (this._length / this.capacity) * 100;
  }

  /**
   * Whether the buffer is at capacity
   */
  get isFull(): boolean {
    return this._length === this.capacity;
  }

  /**
   * Push an item into the buffer.
   * If full, the oldest item is overwritten and droppedCount is incremented.
   *
   * @param item - The item to add
   * @returns true if an item was dropped, false otherwise
   */
  push(item: T): boolean {
    let dropped = false;

    // Truncate string items if maxLineLength is set
    let processedItem = item;
    if (this.maxLineLength && typeof item === 'string') {
      processedItem =
        item.length > this.maxLineLength
          ? ((item.slice(0, this.maxLineLength) + '…') as unknown as T)
          : item;
    }

    // Check if we're about to overwrite
    if (this._length === this.capacity) {
      this._droppedCount++;
      dropped = true;
    } else {
      this._length++;
    }

    // Write to current head position
    this.buffer[this.head] = processedItem;
    this.head = (this.head + 1) % this.capacity;

    // Check for buffer pressure warning
    this.checkPressure();

    return dropped;
  }

  /**
   * Push multiple items into the buffer.
   *
   * @param items - Array of items to add
   * @returns Number of items that were dropped
   */
  pushMany(items: T[]): number {
    let droppedThisCall = 0;
    for (const item of items) {
      if (this.push(item)) {
        droppedThisCall++;
      }
    }
    return droppedThisCall;
  }

  /**
   * Clear all items from the buffer and reset dropped count.
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this._length = 0;
    this._droppedCount = 0;
    this.warningEmitted = false;
  }

  /**
   * Convert buffer contents to an array in correct order (oldest to newest).
   * This is O(n) where n is the number of items in the buffer.
   */
  toArray(): T[] {
    if (this._length === 0) return [];

    const result: T[] = new Array(this._length);

    if (this._length < this.capacity) {
      // Buffer not full yet, items are from 0 to head-1
      for (let i = 0; i < this._length; i++) {
        result[i] = this.buffer[i] as T;
      }
    } else {
      // Buffer is full, read from head (oldest) to head-1 (newest)
      for (let i = 0; i < this._length; i++) {
        const index = (this.head + i) % this.capacity;
        result[i] = this.buffer[index] as T;
      }
    }

    return result;
  }

  /**
   * Get the item at the specified index (0 = oldest).
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this._length) return undefined;

    if (this._length < this.capacity) {
      return this.buffer[index];
    } else {
      const actualIndex = (this.head + index) % this.capacity;
      return this.buffer[actualIndex];
    }
  }

  /**
   * Get a slice of items from the buffer.
   *
   * @param start - Start index (inclusive)
   * @param end - End index (exclusive), defaults to length
   */
  slice(start: number, end?: number): T[] {
    const actualEnd = end ?? this._length;
    const normalizedStart = Math.max(0, start);
    const normalizedEnd = Math.min(this._length, actualEnd);

    if (normalizedStart >= normalizedEnd) return [];

    const result: T[] = [];
    for (let i = normalizedStart; i < normalizedEnd; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Reset the warning flag so it can be emitted again.
   * Useful after displaying a warning to the user.
   */
  resetWarning(): void {
    this.warningEmitted = false;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private checkPressure(): void {
    if (this.warningEmitted || !this.onPressure) return;

    const usage = this.usagePercentage;
    if (usage >= this.warnAtPercentage) {
      this.warningEmitted = true;
      this.onPressure(usage);
    }
  }
}

// =============================================================================
// Output Buffer with Dropped Line Indicator
// =============================================================================

export type OutputBufferOptions = {
  /** Maximum number of lines to store */
  maxLines?: number;
  /** Maximum length of each line */
  maxLineLength?: number;
  /** Warning threshold percentage */
  warnAtPercentage?: number;
  /** Callback when pressure threshold is reached */
  onPressure?: (tabId: string, usage: number) => void;
  /** Tab identifier for pressure callback */
  tabId?: string;
};

const DEFAULT_MAX_LINES = 10_000;
const DEFAULT_MAX_LINE_LENGTH = 5_000;
const DEFAULT_WARN_PERCENTAGE = 80;

/**
 * Specialized output buffer for tab process output.
 * Wraps RingBuffer with dropped line indicator support.
 */
export class OutputBuffer {
  private buffer: RingBuffer<string>;
  private readonly tabId: string;

  constructor(options: OutputBufferOptions = {}) {
    this.tabId = options.tabId ?? 'unknown';
    this.buffer = new RingBuffer<string>({
      capacity: options.maxLines ?? DEFAULT_MAX_LINES,
      maxLineLength: options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH,
      warnAtPercentage: options.warnAtPercentage ?? DEFAULT_WARN_PERCENTAGE,
      onPressure: options.onPressure
        ? (usage) => options.onPressure!(this.tabId, usage)
        : undefined,
    });
  }

  get length(): number {
    return this.buffer.length;
  }

  get droppedCount(): number {
    return this.buffer.droppedCount;
  }

  get usagePercentage(): number {
    return this.buffer.usagePercentage;
  }

  get isFull(): boolean {
    return this.buffer.isFull;
  }

  /**
   * Push lines into the buffer.
   */
  push(...lines: string[]): void {
    this.buffer.pushMany(lines);
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer.clear();
  }

  /**
   * Get all lines as an array with dropped line indicator if applicable.
   * The dropped indicator is inserted at the beginning if lines were dropped.
   */
  toArray(): string[] {
    const lines = this.buffer.toArray();
    const dropped = this.buffer.droppedCount;

    if (dropped > 0) {
      return [`... (${dropped.toLocaleString()} lines dropped) ...`, ...lines];
    }

    return lines;
  }

  /**
   * Get lines without the dropped indicator.
   */
  toArrayRaw(): string[] {
    return this.buffer.toArray();
  }

  /**
   * Reset the warning flag.
   */
  resetWarning(): void {
    this.buffer.resetWarning();
  }
}
