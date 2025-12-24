/**
 * Event normalization utilities for testing.
 *
 * These utilities ensure snapshot stability by normalizing
 * dynamic values like timestamps and auto-generated IDs.
 */

import type { CLIEvent } from '@openpok/core';

/**
 * Normalize events for snapshot stability.
 *
 * - Replaces timestamp-based IDs with sequential counters
 * - Preserves event structure and relationships
 * - Makes snapshots deterministic across runs
 *
 * @example
 * ```ts
 * const { events } = await captureEvents(['with-pre']);
 * const normalized = normalizeEvents(events);
 * expect(normalized).toEqual(fixtures.commandWithPre);
 * ```
 */
export function normalizeEvents(events: CLIEvent[]): CLIEvent[] {
  const idMap = new Map<string, string>();
  let activityCounter = 0;
  let groupCounter = 0;

  function normalizeId(id: string): string {
    if (idMap.has(id)) {
      return idMap.get(id)!;
    }

    let normalized: string;
    if (id.startsWith('activity-')) {
      normalized = `activity-${activityCounter++}`;
    } else if (id.startsWith('group-')) {
      normalized = `group-${groupCounter++}`;
    } else {
      normalized = id;
    }

    idMap.set(id, normalized);
    return normalized;
  }

  return events.map((event) => {
    const normalized = { ...event };

    // Normalize IDs in various event types
    if ('id' in normalized && typeof normalized.id === 'string') {
      (normalized as { id: string }).id = normalizeId(normalized.id);
    }
    if ('parentId' in normalized && typeof normalized.parentId === 'string') {
      (normalized as { parentId: string }).parentId = normalizeId(normalized.parentId);
    }
    if ('activityId' in normalized && typeof normalized.activityId === 'string') {
      (normalized as { activityId: string }).activityId = normalizeId(normalized.activityId);
    }

    // Normalize error messages that might contain paths
    if ('error' in normalized && normalized.error instanceof Error) {
      (normalized as { error: string }).error = normalized.error.message;
    }

    // Strip undefined values for cleaner comparison
    return Object.fromEntries(
      Object.entries(normalized).filter(([, v]) => v !== undefined)
    ) as CLIEvent;
  });
}

/**
 * Filter events to only include specific types.
 *
 * @example
 * ```ts
 * const activityEvents = filterEvents(events, ['activity:start', 'activity:success']);
 * ```
 */
export function filterEvents<T extends CLIEvent['type']>(
  events: CLIEvent[],
  types: T[]
): Extract<CLIEvent, { type: T }>[] {
  return events.filter((e): e is Extract<CLIEvent, { type: T }> => types.includes(e.type as T));
}

/**
 * Extract just the event types for quick assertions.
 *
 * @example
 * ```ts
 * const types = eventTypes(events);
 * expect(types).toEqual(['group:start', 'activity:start', 'activity:success', 'group:end']);
 * ```
 */
export function eventTypes(events: CLIEvent[]): CLIEvent['type'][] {
  return events.map((e) => e.type);
}
