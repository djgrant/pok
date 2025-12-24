/**
 * Clack Reporter Adapter
 *
 * Implements the ReporterAdapter interface using @clack/prompts.
 * Consumes CLI events from the EventBus and renders them to the terminal.
 *
 * Design principles:
 * - Groups are visual containers with a bold title (intro) and completion indicator (outro)
 * - Activities within sequential groups show as spinner items that complete with checkmarks
 * - Parallel groups use a single spinner that tracks progress, showing completions as they finish
 * - Logs during an active spinner will pause the spinner, show the log, then resume
 * - Process output is never interleaved with spinners
 *
 * Rendering strategy:
 * - group:start -> p.intro() with bold label (or plain text in plain mode)
 * - group:end -> p.outro() with success indicator
 * - activity:start (sequential) -> spinner.start() (or plain text indicator)
 * - activity:start (parallel) -> track activity, update combined spinner
 * - activity:success -> spinner.stop() with checkmark (code 0) or update combined spinner
 * - activity:failure -> spinner.stop() with X (code 1)
 * - activity:update -> spinner.message()
 * - log -> pause spinner if active, p.log.*, resume spinner
 *
 * Plain mode (--plain or CI environment):
 * - When unicode is disabled, uses ASCII symbols and bypasses clack's decorative output
 * - When color is disabled (--no-color or NO_COLOR env), strips ANSI color codes
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import type {
  ReporterAdapter,
  ReporterAdapterController,
  EventBus,
  CLIEvent,
  ActivityId,
  GroupId,
  GroupLayout,
  LogLevel,
} from '@openpok/core';

type SpinnerInstance = ReturnType<typeof p.spinner>;

type SpinnerEntry = {
  spinner: SpinnerInstance;
  label: string;
  /** Current message being displayed (for restore after log) */
  currentMessage: string;
  /** Parent group ID for tracking failures */
  parentGroupId?: GroupId;
};

type GroupEntry = {
  label: string;
  layout: GroupLayout;
  /** Track if any activity in this group has failed */
  hasFailure: boolean;
};

type ParallelActivity = {
  label: string;
  groupId: GroupId;
  status: 'pending' | 'success' | 'failure';
  error?: string;
};

/**
 * A log message that was buffered during an active spinner
 */
type BufferedLog = {
  activityId: ActivityId;
  level: LogLevel;
  message: string;
  timestamp: number;
};

/** Maximum number of logs to buffer per activity to prevent memory issues */
const MAX_BUFFERED_LOGS_PER_ACTIVITY = 100;

/**
 * State for tracking active spinners and groups
 */
type AdapterState = {
  /** Active spinners for sequential activities */
  spinners: Map<ActivityId, SpinnerEntry>;
  /** Active groups with their layout info */
  groups: Map<GroupId, GroupEntry>;
  /** For parallel groups: track activities and use a single spinner */
  parallelActivities: Map<ActivityId, ParallelActivity>;
  /** The single spinner used for parallel group progress */
  parallelSpinner: SpinnerEntry | null;
  /** The group ID that owns the parallel spinner */
  parallelSpinnerGroupId: GroupId | null;
  /** When true, ignore all events (for fullscreen TUI takeover) */
  suspended: boolean;
  /** Activities that were suspended - we'll show completion for these on resume */
  suspendedActivities: Map<ActivityId, { label: string }>;
  /** Logs buffered during active spinners, to be flushed on activity completion */
  bufferedLogs: BufferedLog[];
  /** Verbose mode - when true, all logs are displayed immediately (no buffering) */
  verbose: boolean;
};

/**
 * Update the parallel spinner message based on current activity states
 */
function updateParallelSpinnerMessage(state: AdapterState): void {
  if (!state.parallelSpinner) return;

  const activities = Array.from(state.parallelActivities.values()).filter(
    (a) => a.groupId === state.parallelSpinnerGroupId
  );

  const pending = activities.filter((a) => a.status === 'pending');
  const completed = activities.filter((a) => a.status !== 'pending');

  if (pending.length === 0) {
    // All done - this will be cleaned up by group:end
    return;
  }

  const message =
    pending.length === 1
      ? pending[0]!.label
      : `Running ${pending.length} tasks (${completed.length}/${activities.length} done)`;

  state.parallelSpinner.currentMessage = message;
  state.parallelSpinner.spinner.message(message);
}

/**
 * Display a log message using clack's log functions.
 *
 * @param level - The log level
 * @param message - The message to display
 * @param indented - Whether to indent the log (for buffered logs inside activity context)
 */
function displayLog(level: LogLevel, message: string, indented: boolean = false): void {
  const prefix = indented ? '\u2502  ' : ''; // │  for indented logs
  const formattedMessage = prefix + message;

  switch (level) {
    case 'info':
      p.log.info(formattedMessage);
      break;
    case 'warn':
      p.log.warn(formattedMessage);
      break;
    case 'error':
      p.log.error(formattedMessage);
      break;
    case 'success':
      p.log.success(formattedMessage);
      break;
    case 'step':
      p.log.step(formattedMessage);
      break;
  }
}

/**
 * Flush buffered logs for a specific activity.
 *
 * @param state - The adapter state
 * @param activityId - The activity ID whose logs should be flushed
 */
function flushLogsForActivity(state: AdapterState, activityId: ActivityId): void {
  // Filter logs for this activity, sorted by timestamp
  const activityLogs = state.bufferedLogs
    .filter((log) => log.activityId === activityId)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Display each buffered log with indentation
  for (const log of activityLogs) {
    displayLog(log.level, log.message, true);
  }

  // Remove flushed logs from buffer
  state.bufferedLogs = state.bufferedLogs.filter((log) => log.activityId !== activityId);
}

/**
 * Options for the reporter adapter
 */
export type ReporterAdapterOptions = {
  /** When true, logs are displayed immediately instead of being buffered during spinners */
  verbose?: boolean;
};

/**
 * Create a Clack-based ReporterAdapter
 *
 * @param options - Optional configuration for the adapter
 */
export function createReporterAdapter(options?: ReporterAdapterOptions): ReporterAdapter {
  return {
    start(bus: EventBus): ReporterAdapterController {
      const state: AdapterState = {
        spinners: new Map(),
        groups: new Map(),
        parallelActivities: new Map(),
        parallelSpinner: null,
        parallelSpinnerGroupId: null,
        suspended: false,
        suspendedActivities: new Map(),
        bufferedLogs: [],
        verbose: options?.verbose ?? false,
      };

      const handleEvent = (event: CLIEvent): void => {
        switch (event.type) {
          // Root lifecycle (app-level intro/outro)
          case 'root:start':
          case 'root:end':
            // Handled by the router
            break;

          // Group lifecycle (command-level intro/outro)
          case 'group:start': {
            if (state.suspended) break;

            state.groups.set(event.id, {
              label: event.label,
              layout: event.layout,
              hasFailure: false,
            });
            p.intro(pc.bold(event.label));
            break;
          }

          case 'group:end': {
            if (state.suspended) break;

            const group = state.groups.get(event.id);
            state.groups.delete(event.id);

            let hasFailures = group?.hasFailure ?? false;
            // Collect errors to print after the group closes
            const deferredErrors: string[] = [];

            // If this was a parallel group, show completion results and clean up
            if (group?.layout === 'parallel') {
              // Collect activities for this group
              const activities = Array.from(state.parallelActivities.entries()).filter(
                ([, a]) => a.groupId === event.id
              );

              // Sort: successes first, then failures (so failures are more visible at end)
              const sorted = activities.sort(([, a], [, b]) => {
                if (a.status === 'success' && b.status !== 'success') return -1;
                if (a.status !== 'success' && b.status === 'success') return 1;
                return 0;
              });

              // Stop the parallel spinner - use first success as the message
              if (state.parallelSpinner && state.parallelSpinnerGroupId === event.id) {
                const firstSuccess = sorted.find(([, a]) => a.status === 'success');
                if (firstSuccess) {
                  // Show first success via spinner stop
                  state.parallelSpinner.spinner.stop(firstSuccess[1].label, 0);
                  // Flush buffered logs for this activity
                  flushLogsForActivity(state, firstSuccess[0]);
                  state.parallelActivities.delete(firstSuccess[0]);
                } else {
                  // All failed - show first failure label (not error) via spinner stop
                  const firstFailure = sorted[0];
                  if (firstFailure) {
                    state.parallelSpinner.spinner.stop(firstFailure[1].label, 1);
                    hasFailures = true;
                    // Defer the error message to print after outro
                    if (firstFailure[1].error) {
                      deferredErrors.push(firstFailure[1].error);
                    }
                    // Flush buffered logs for this activity
                    flushLogsForActivity(state, firstFailure[0]);
                    state.parallelActivities.delete(firstFailure[0]);
                  } else {
                    state.parallelSpinner.spinner.stop('Complete', 0);
                  }
                }
                state.parallelSpinner = null;
                state.parallelSpinnerGroupId = null;
              }

              // Show remaining results (only labels inside group, defer errors)
              for (const [activityId, activity] of state.parallelActivities) {
                if (activity.groupId !== event.id) continue;
                if (activity.status === 'success') {
                  p.log.success(activity.label);
                } else if (activity.status === 'failure') {
                  hasFailures = true;
                  // Show label inside group, defer error message
                  p.log.error(activity.label);
                  if (activity.error) {
                    deferredErrors.push(activity.error);
                  }
                }
                // Flush any buffered logs for this parallel activity
                flushLogsForActivity(state, activityId);
              }

              // Clean up all activities for this group
              for (const [id, activity] of [...state.parallelActivities]) {
                if (activity.groupId === event.id) {
                  state.parallelActivities.delete(id);
                }
              }
            }

            // Show appropriate outro based on whether there were failures
            if (hasFailures) {
              p.outro(pc.red('\u2718 Failed'));
            } else {
              p.outro(pc.green('\u2714 Done'));
            }

            // Print deferred error messages after the group closes
            for (const error of deferredErrors) {
              p.log.error(error);
            }
            break;
          }

          // Activity lifecycle (task-level spinner)
          case 'activity:start': {
            if (state.suspended) break;

            // Find the parent group to determine layout
            const parentGroup = event.parentId ? state.groups.get(event.parentId as GroupId) : null;

            if (parentGroup?.layout === 'parallel') {
              // Track this activity for the parallel group
              state.parallelActivities.set(event.id, {
                label: event.label,
                groupId: event.parentId as GroupId,
                status: 'pending',
              });

              // Create or update the parallel spinner
              if (!state.parallelSpinner) {
                const spinner = p.spinner();
                state.parallelSpinner = {
                  spinner,
                  label: event.label,
                  currentMessage: event.label,
                };
                state.parallelSpinnerGroupId = event.parentId as GroupId;
                spinner.start(event.label);
              }
              updateParallelSpinnerMessage(state);
            } else {
              // Sequential: create individual spinner
              const spinner = p.spinner();
              state.spinners.set(event.id, {
                spinner,
                label: event.label,
                currentMessage: event.label,
                parentGroupId: event.parentId as GroupId | undefined,
              });
              spinner.start(event.label);
            }
            break;
          }

          case 'activity:update': {
            if (state.suspended) break;

            // Check if this is a parallel activity
            const parallelActivity = state.parallelActivities.get(event.id);
            if (parallelActivity) {
              // Update the activity label if message provided
              if (event.payload.message) {
                parallelActivity.label = event.payload.message;
                updateParallelSpinnerMessage(state);
              }
              break;
            }

            // Sequential activity
            const entry = state.spinners.get(event.id);
            if (entry) {
              const text =
                event.payload.message ||
                (event.payload.progress !== undefined ? `${event.payload.progress}%` : null);
              if (text) {
                entry.currentMessage = text;
                entry.spinner.message(text);
              }
            }
            break;
          }

          case 'activity:success': {
            // Check if this is a parallel activity
            const parallelActivity = state.parallelActivities.get(event.id);
            if (parallelActivity) {
              parallelActivity.status = 'success';
              updateParallelSpinnerMessage(state);
              // Note: For parallel activities, logs will be flushed at group:end
              break;
            }

            // Sequential activity
            const entry = state.spinners.get(event.id);
            if (entry) {
              entry.spinner.stop(entry.label, 0);
              state.spinners.delete(event.id);

              // Flush any buffered logs for this activity
              flushLogsForActivity(state, event.id);
            } else {
              // Check if this was a suspended activity
              const suspended = state.suspendedActivities.get(event.id);
              if (suspended && !state.suspended) {
                p.log.success(suspended.label);
                state.suspendedActivities.delete(event.id);
              }
            }
            break;
          }

          case 'activity:failure': {
            const errorMessage =
              event.error instanceof Error ? event.error.message : String(event.error);

            // Check if this is a parallel activity
            const parallelActivity = state.parallelActivities.get(event.id);
            if (parallelActivity) {
              parallelActivity.status = 'failure';
              parallelActivity.error = errorMessage;
              // Mark the parent group as having failures
              const parentGroup = state.groups.get(parallelActivity.groupId);
              if (parentGroup) {
                parentGroup.hasFailure = true;
              }
              updateParallelSpinnerMessage(state);
              break;
            }

            // Sequential activity
            const entry = state.spinners.get(event.id);
            if (entry) {
              // Mark the parent group as having failures
              if (entry.parentGroupId) {
                const parentGroup = state.groups.get(entry.parentGroupId);
                if (parentGroup) {
                  parentGroup.hasFailure = true;
                }
              }
              entry.spinner.stop(errorMessage, 1);
              state.spinners.delete(event.id);

              // Flush any buffered logs for this activity
              flushLogsForActivity(state, event.id);
            } else {
              // Check if this was a suspended activity
              const suspended = state.suspendedActivities.get(event.id);
              if (suspended && !state.suspended) {
                p.log.error(`${suspended.label}: ${errorMessage}`);
                state.suspendedActivities.delete(event.id);
              }
            }
            break;
          }

          // Log events
          case 'log': {
            if (state.suspended) break;

            // Verbose mode: always display logs immediately
            if (state.verbose) {
              displayLog(event.level, event.message, false);
              break;
            }

            const hasActiveSpinners = state.spinners.size > 0 || state.parallelSpinner !== null;

            // Error logs interrupt spinners immediately
            if (event.level === 'error' && hasActiveSpinners && event.activityId) {
              const spinner = state.spinners.get(event.activityId);
              if (spinner) {
                // Temporarily stop spinner, show error, resume
                const currentMessage = spinner.currentMessage;
                spinner.spinner.stop(currentMessage, 0);
                displayLog(event.level, event.message, false);
                spinner.spinner.start(currentMessage);
              } else {
                // No spinner for this activity, just display
                displayLog(event.level, event.message, false);
              }
              break;
            }

            // Buffer logs during active spinners
            if (hasActiveSpinners && event.activityId) {
              // Check if we've hit the buffer limit for this activity
              const activityLogCount = state.bufferedLogs.filter(
                (log) => log.activityId === event.activityId
              ).length;

              if (activityLogCount < MAX_BUFFERED_LOGS_PER_ACTIVITY) {
                state.bufferedLogs.push({
                  activityId: event.activityId,
                  level: event.level,
                  message: event.message,
                  timestamp: Date.now(),
                });
              }
              // If over limit, silently drop (prevent memory issues)
              break;
            }

            // No active spinners - display immediately
            displayLog(event.level, event.message, false);
            break;
          }

          // Reporter control events
          case 'reporter:suspend': {
            state.suspended = true;
            // Stop all active spinners and track them for completion messages
            for (const [id, entry] of state.spinners) {
              try {
                entry.spinner.stop(entry.label + '...', 0);
                state.suspendedActivities.set(id, { label: entry.label });
              } catch {
                // Spinner may already be stopped
              }
            }
            state.spinners.clear();

            // Also stop parallel spinner
            if (state.parallelSpinner) {
              try {
                state.parallelSpinner.spinner.stop('Paused...', 0);
              } catch {
                // Spinner may already be stopped
              }
              state.parallelSpinner = null;
            }
            break;
          }

          case 'reporter:resume': {
            state.suspended = false;
            break;
          }
        }
      };

      const unsubscribe = bus.on(handleEvent);

      return {
        stop(): void {
          // Stop all active spinners
          for (const entry of state.spinners.values()) {
            try {
              entry.spinner.stop('Stopped', 1);
            } catch {
              // Spinner may already be stopped
            }
          }
          if (state.parallelSpinner) {
            try {
              state.parallelSpinner.spinner.stop('Stopped', 1);
            } catch {
              // Spinner may already be stopped
            }
          }
          state.spinners.clear();
          state.groups.clear();
          state.parallelActivities.clear();
          state.parallelSpinner = null;
          state.parallelSpinnerGroupId = null;
          unsubscribe();
        },
      };
    },
  };
}
