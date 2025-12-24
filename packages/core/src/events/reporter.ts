/**
 * Reporter Interface and Implementation
 *
 * The Reporter abstracts the creation of events and handles **scoping**.
 * A Reporter instance is always tied to a context (Root, Group, or Activity).
 */

import type { EventBus } from './bus.js';
import type { ActivityId, GroupId, GroupLayout, LogLevel } from './types.js';
import { CheckError } from '../lib/check.js';

/**
 * Activity update payload - can be a string (shorthand for message) or full payload
 */
export type UpdatePayload =
  | string
  | {
      progress?: number;
      message?: string;
      [key: string]: unknown;
    };

/**
 * Group options for creating a group scope
 */
export type GroupOptions = {
  layout: GroupLayout;
};

/**
 * Basic logging capabilities
 */
type LogReporter = {
  /**
   * Emit a log entry at info level
   */
  info(message: string): void;

  /**
   * Emit a log entry at warn level
   */
  warn(message: string): void;

  /**
   * Emit a log entry at error level
   */
  error(message: string | Error): void;

  /**
   * Emit a log entry at success level
   */
  success(message: string): void;
};

/**
 * Activity update capabilities
 */
type UpdateReporter = {
  /**
   * Emit a data update for the current scope
   * @param payload - String (shorthand for message) or object with progress/message/custom data
   */
  update(payload: UpdatePayload): void;
};

/**
 * Step sectioning capabilities
 */
type StepReporter = {
  /**
   * Emit a log entry at step level
   */
  step(message: string): void;
};

/**
 * Scope nesting capabilities
 */
type NestingReporter = {
  /**
   * Create a child activity. Returns a Reporter scoped to that new activity.
   * The activity lifecycle (start/success/failure) is managed automatically.
   */
  activity<T>(label: string, fn: (reporter: Reporter) => Promise<T> | T): Promise<T>;

  /**
   * Create a child activity with metadata.
   */
  activityWithMeta<T>(
    label: string,
    meta: Record<string, unknown>,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T>;

  /**
   * Create a grouping (layout hint).
   * Groups are containers for activities with layout hints for the UI.
   */
  group<T>(
    label: string,
    options: GroupOptions,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T>;
};

/**
 * Suspend/resume capabilities for fullscreen takeover (TUI apps)
 */
type SuspendReporter = {
  /**
   * Suspend reporter output. Call before taking over the terminal (e.g., for TUI).
   * While suspended, the reporter adapter will stop all spinners and ignore events.
   */
  suspend(): void;

  /**
   * Resume reporter output. Call after releasing the terminal.
   */
  resume(): void;
};

/**
 * Restricted reporter for tasks - only basic logging, updates, and suspend/resume
 */
export type TaskReporter = LogReporter & UpdateReporter & SuspendReporter;

/**
 * Reporter for commands - logging and sectioning only, no nesting
 */
export type CommandReporter = LogReporter & StepReporter;

/**
 * The User-Facing Reporter API - full access to all methods
 */
export type Reporter = LogReporter &
  UpdateReporter &
  StepReporter &
  SuspendReporter &
  NestingReporter;

/**
 * Scope type for the reporter
 */
type ScopeType = 'root' | 'group' | 'activity';

/**
 * Generate a unique ID with a prefix
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * ScopedReporter - Implementation of Reporter tied to a specific scope
 */
export class ScopedReporter implements Reporter {
  private readonly bus: EventBus;
  private readonly scopeType: ScopeType;
  private readonly scopeId: ActivityId | GroupId | 'root';
  private readonly parentId?: ActivityId | GroupId;

  constructor(
    bus: EventBus,
    scopeType: ScopeType,
    scopeId: ActivityId | GroupId | 'root',
    parentId?: ActivityId | GroupId
  ) {
    this.bus = bus;
    this.scopeType = scopeType;
    this.scopeId = scopeId;
    this.parentId = parentId;
  }

  update(payload: UpdatePayload): void {
    if (this.scopeType !== 'activity') {
      return;
    }

    const normalizedPayload = typeof payload === 'string' ? { message: payload } : payload;

    this.bus.emit({
      type: 'activity:update',
      id: this.scopeId as ActivityId,
      payload: normalizedPayload,
    });
  }

  private log(level: LogLevel, message: string): void {
    this.bus.emit({
      type: 'log',
      activityId: this.scopeType === 'activity' ? (this.scopeId as ActivityId) : undefined,
      level,
      message,
    });
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string | Error): void {
    const errorMessage = message instanceof Error ? message.message : String(message);
    this.log('error', errorMessage);
  }

  success(message: string): void {
    this.log('success', message);
  }

  step(message: string): void {
    this.log('step', message);
  }

  suspend(): void {
    this.bus.emit({ type: 'reporter:suspend' });
  }

  resume(): void {
    this.bus.emit({ type: 'reporter:resume' });
  }

  async activity<T>(label: string, fn: (reporter: Reporter) => Promise<T> | T): Promise<T> {
    return this.activityWithMeta(label, {}, fn);
  }

  async activityWithMeta<T>(
    label: string,
    meta: Record<string, unknown>,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T> {
    const activityId = generateId('activity');

    this.bus.emit({
      type: 'activity:start',
      id: activityId,
      parentId: this.scopeId === 'root' ? undefined : this.scopeId,
      label,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    });

    const activityReporter = new ScopedReporter(
      this.bus,
      'activity',
      activityId,
      this.scopeId === 'root' ? undefined : this.scopeId
    );

    try {
      const result = await fn(activityReporter);

      this.bus.emit({
        type: 'activity:success',
        id: activityId,
        result,
      });

      return result;
    } catch (error) {
      // Extract remediation info from CheckError if available
      const remediation =
        error instanceof CheckError ? error.remediation : undefined;
      const documentationUrl =
        error instanceof CheckError ? error.documentationUrl : undefined;

      this.bus.emit({
        type: 'activity:failure',
        id: activityId,
        error: error instanceof Error ? error : String(error),
        remediation,
        documentationUrl,
      });

      throw error;
    }
  }

  async group<T>(
    label: string,
    options: GroupOptions,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T> {
    // Prevent nested groups - groups can only be created from root scope
    if (this.scopeType === 'group') {
      throw new Error(
        `Cannot create nested group "${label}" inside group "${this.scopeId}". ` +
          `Groups must be created at the root level. Consider using activities ` +
          `inside the group instead.`
      );
    }

    const groupId = generateId('group');

    this.bus.emit({
      type: 'group:start',
      id: groupId,
      parentId: undefined, // Groups are always top-level now
      label,
      layout: options.layout,
    });

    const groupReporter = new ScopedReporter(
      this.bus,
      'group',
      groupId,
      undefined // No parent for groups
    );

    try {
      const result = await fn(groupReporter);

      this.bus.emit({
        type: 'group:end',
        id: groupId,
      });

      return result;
    } catch (error) {
      this.bus.emit({
        type: 'group:end',
        id: groupId,
      });

      throw error;
    }
  }
}

/**
 * Create a root reporter for the CLI application
 */
export function createRootReporter(bus: EventBus, appName: string, version?: string): Reporter {
  bus.emit({
    type: 'root:start',
    appName,
    version,
  });

  return new ScopedReporter(bus, 'root', 'root');
}

/**
 * Emit root:end event when the CLI application exits
 */
export function emitRootEnd(bus: EventBus, exitCode: number): void {
  bus.emit({
    type: 'root:end',
    exitCode,
  });
}
