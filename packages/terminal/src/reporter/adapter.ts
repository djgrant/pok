/**
 * Terminal Reporter Adapter
 *
 * Consumes CLI events from the EventBus and renders them through the owned
 * renderer (theme + frame + live region). This file is the layout policy: it
 * maps semantic events to frame calls and holds the taste decisions. All
 * actual drawing lives in ./renderer.
 *
 * Policy:
 * - group:start/end -> frame.open / frame.close
 * - sequential activity -> live row while running; frame.line on completion
 * - parallel group -> one live row summarising progress; per-activity lines
 *   in completion order; errors deferred to blocks after the box closes
 * - logs inside an activity -> flushed after the activity completes (reads
 *   well); error-level logs print immediately
 * - logs outside any box -> standalone blocks (frame.block)
 * - markdown -> rendered to ANSI and passed through raw
 *
 * Output modes (interactive, unicode, color) are theme/live-region config,
 * not code branches: non-interactive output disables the live region, ASCII
 * and no-color are theme swaps.
 */

import pc from 'picocolors';
import type {
  ReporterAdapter,
  ReporterAdapterController,
  EventBus,
  CLIEvent,
  ActivityId,
  GroupId,
  LogLevel,
  OutputConfig,
} from '@pokit/core';
import { detectOutputConfig, CommandError, markPresented } from '@pokit/core';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { createTheme, type LineKind } from './renderer/theme';
import { Frame } from './renderer/frame';
import { LiveRegion } from './renderer/live-region';

/**
 * Render a markdown document for terminal output.
 *
 * When color is enabled (a styled TTY), the markdown is rendered to ANSI via
 * marked + marked-terminal. Otherwise the raw markdown is passed through
 * unchanged so it composes with pipes (`pok docs README.md | glow`), files,
 * and `--no-color` consumers.
 */
function renderMarkdown(content: string, outputConfig: OutputConfig): string {
  if (!outputConfig.color) {
    return content.replace(/\n+$/, '');
  }
  const width = process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80;
  const marked = new Marked(markedTerminal({ width, reflowText: true }) as never);
  return String(marked.parse(content)).replace(/\n+$/, '');
}

/**
 * Extract error message and optional output from an error.
 * If the error is a CommandError with output, includes that in the message.
 */
function formatErrorMessage(error: Error | string): string {
  if (typeof error === 'string') return error;
  if (error instanceof CommandError && error.output) {
    return `${error.message}\n\n${error.output}`;
  }
  return error.message;
}

/** Append remediation steps and a docs link to a message as extra lines. */
function withRemediation(
  message: string,
  remediation: string[] | undefined,
  documentationUrl: string | undefined
): string {
  let text = message;
  if (remediation && remediation.length > 0) {
    text += '\n\nTo fix:';
    for (const step of remediation) {
      text += `\n  - ${step}`;
    }
  }
  if (documentationUrl) {
    text += `\n\nMore info: ${documentationUrl}`;
  }
  return text;
}

const LOG_KIND: Record<LogLevel, LineKind> = {
  info: 'info',
  warn: 'warn',
  error: 'error',
  success: 'success',
  step: 'step',
};

/** Maximum number of logs to buffer per activity to prevent memory issues */
const MAX_BUFFERED_LOGS_PER_ACTIVITY = 100;

type SequentialActivity = {
  label: string;
  groupId?: GroupId;
};

type ParallelActivity = {
  label: string;
  groupId: GroupId;
  status: 'pending' | 'success' | 'failure';
};

type GroupEntry = {
  layout: 'sequence' | 'parallel';
  hasFailure: boolean;
  /** Parallel errors deferred to blocks after the box closes. */
  deferredErrors: string[];
};

type BufferedLog = { level: LogLevel; message: string };

/**
 * Options for the reporter adapter
 */
export type ReporterAdapterOptions = {
  /** When true, logs are displayed immediately instead of being buffered during activities */
  verbose?: boolean;
  /** Output configuration (color, unicode, interactive, verbose settings) */
  output?: OutputConfig;
};

/**
 * Create a terminal ReporterAdapter
 */
export function createReporterAdapter(options?: ReporterAdapterOptions): ReporterAdapter {
  const outputConfig: OutputConfig = options?.output ?? detectOutputConfig(process.argv.slice(2));
  if (outputConfig.interactive === undefined) {
    outputConfig.interactive = true;
  }
  if (options?.verbose !== undefined) {
    outputConfig.verbose = options.verbose;
  }

  return {
    start(bus: EventBus): ReporterAdapterController {
      const theme = createTheme(outputConfig);
      const region = new LiveRegion(Boolean(outputConfig.interactive), theme);
      const frame = new Frame(theme, (line) => region.writeLine(line));

      const groups = new Map<GroupId, GroupEntry>();
      const sequential = new Map<ActivityId, SequentialActivity>();
      const parallel = new Map<ActivityId, ParallelActivity>();
      const bufferedLogs = new Map<ActivityId, BufferedLog[]>();
      const verbose = outputConfig.verbose;

      function flushLogs(activityId: ActivityId): void {
        const logs = bufferedLogs.get(activityId);
        if (!logs) return;
        bufferedLogs.delete(activityId);
        for (const log of logs) {
          frame.line(LOG_KIND[log.level], log.message);
        }
      }

      function updateParallelSummary(groupId: GroupId): void {
        const activities = [...parallel.values()].filter((a) => a.groupId === groupId);
        const pending = activities.filter((a) => a.status === 'pending');
        if (pending.length === 0) return;
        const message =
          pending.length === 1
            ? pending[0]!.label
            : `Running ${pending.length} tasks (${activities.length - pending.length}/${activities.length} done)`;
        region.start(message);
      }

      function markGroupFailure(groupId: GroupId | undefined): void {
        if (!groupId) return;
        const group = groups.get(groupId);
        if (group) group.hasFailure = true;
      }

      const handleEvent = (event: CLIEvent): void => {
        switch (event.type) {
          // Root lifecycle is handled by the router
          case 'root:start':
          case 'root:end':
            break;

          case 'group:start': {
            groups.set(event.id, {
              layout: event.layout,
              hasFailure: false,
              deferredErrors: [],
            });
            frame.open(outputConfig.color ? pc.bold(event.label) : event.label);
            break;
          }

          case 'group:end': {
            const group = groups.get(event.id);
            groups.delete(event.id);

            if (group?.layout === 'parallel') {
              region.stop();
              // Clean up any activities that never completed
              for (const [id, activity] of [...parallel]) {
                if (activity.groupId === event.id) {
                  flushLogs(id);
                  parallel.delete(id);
                }
              }
            }

            frame.close(group?.hasFailure ? 'failed' : 'done');

            for (const error of group?.deferredErrors ?? []) {
              frame.block('error', error);
            }
            break;
          }

          case 'activity:start': {
            const parentGroup = event.parentId ? groups.get(event.parentId as GroupId) : null;
            if (parentGroup?.layout === 'parallel') {
              parallel.set(event.id, {
                label: event.label,
                groupId: event.parentId as GroupId,
                status: 'pending',
              });
              updateParallelSummary(event.parentId as GroupId);
            } else {
              sequential.set(event.id, {
                label: event.label,
                groupId: event.parentId as GroupId | undefined,
              });
              region.start(event.label);
            }
            break;
          }

          case 'activity:update': {
            const message =
              event.payload.message ||
              (event.payload.progress !== undefined ? `${event.payload.progress}%` : null);
            if (!message) break;

            const parallelActivity = parallel.get(event.id);
            if (parallelActivity) {
              parallelActivity.label = message;
              updateParallelSummary(parallelActivity.groupId);
            } else if (sequential.has(event.id)) {
              sequential.get(event.id)!.label = message;
              region.update(message);
            }
            break;
          }

          case 'activity:success': {
            const parallelActivity = parallel.get(event.id);
            if (parallelActivity) {
              parallelActivity.status = 'success';
              frame.line('activityDone', parallelActivity.label);
              flushLogs(event.id);
              parallel.delete(event.id);
              updateParallelSummary(parallelActivity.groupId);
              break;
            }

            const entry = sequential.get(event.id);
            if (entry) {
              sequential.delete(event.id);
              if (sequential.size === 0) region.stop();
              frame.line('activityDone', entry.label);
              flushLogs(event.id);
            }
            break;
          }

          case 'activity:failure': {
            const errorMessage = formatErrorMessage(event.error);

            // Record that we've surfaced this error to the user, so the
            // top-level CLI handler doesn't print it a second time.
            markPresented(event.error);

            const parallelActivity = parallel.get(event.id);
            if (parallelActivity) {
              parallelActivity.status = 'failure';
              markGroupFailure(parallelActivity.groupId);
              frame.line('activityFailed', parallelActivity.label);
              groups
                .get(parallelActivity.groupId)
                ?.deferredErrors.push(
                  withRemediation(errorMessage, event.remediation, event.documentationUrl)
                );
              flushLogs(event.id);
              parallel.delete(event.id);
              updateParallelSummary(parallelActivity.groupId);
              break;
            }

            const entry = sequential.get(event.id);
            if (entry) {
              sequential.delete(event.id);
              if (sequential.size === 0) region.stop();
              markGroupFailure(entry.groupId);
              frame.line(
                'activityFailed',
                withRemediation(errorMessage, event.remediation, event.documentationUrl)
              );
              flushLogs(event.id);
            }
            break;
          }

          case 'log': {
            const kind = LOG_KIND[event.level];

            // Verbose mode: always display logs immediately
            if (verbose) {
              frame.line(kind, event.message);
              break;
            }

            const activityPending =
              event.activityId !== undefined &&
              (sequential.has(event.activityId) ||
                parallel.get(event.activityId)?.status === 'pending');

            if (activityPending && event.activityId) {
              // Errors surface immediately; other levels flush when the
              // activity completes, so its logs read as one unit.
              if (event.level === 'error') {
                frame.line(kind, event.message);
                break;
              }
              const logs = bufferedLogs.get(event.activityId) ?? [];
              if (logs.length < MAX_BUFFERED_LOGS_PER_ACTIVITY) {
                logs.push({ level: event.level, message: event.message });
                bufferedLogs.set(event.activityId, logs);
              }
              break;
            }

            frame.line(kind, event.message);
            break;
          }

          case 'markdown': {
            frame.raw(renderMarkdown(event.content, outputConfig));
            break;
          }
        }
      };

      const unsubscribe = bus.on(handleEvent);

      return {
        stop(): void {
          region.stop();
          for (const entry of sequential.values()) {
            frame.line('activityFailed', `${entry.label} — stopped`);
          }
          sequential.clear();
          parallel.clear();
          groups.clear();
          bufferedLogs.clear();
          unsubscribe();
        },
      };
    },
  };
}
