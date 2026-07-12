/**
 * Canonical rendering scenarios for the reporter.
 *
 * Each scenario is a named event sequence covering one visual situation the
 * renderer must handle. The gallery test renders every scenario in every
 * output mode and snapshots the result to __gallery__/, so the full visual
 * surface is reviewable as plain text files.
 *
 * Add a scenario here whenever a rendering bug is found: the snapshot then
 * documents the fix and guards against regression.
 */

import type { CLIEvent, OutputConfig } from '@pokit/core';

export type Scenario = {
  name: string;
  description: string;
  events: CLIEvent[];
};

export type OutputMode = {
  name: string;
  output: OutputConfig;
};

/** The three rendering modes worth snapshotting (color is stripped by xterm anyway). */
export const OUTPUT_MODES: OutputMode[] = [
  {
    name: 'interactive',
    output: { color: true, unicode: true, verbose: false, interactive: true },
  },
  {
    name: 'plain-unicode',
    output: { color: false, unicode: true, verbose: false, interactive: false },
  },
  {
    name: 'ascii',
    output: { color: false, unicode: false, verbose: false, interactive: false },
  },
];

export const SCENARIOS: Scenario[] = [
  {
    name: 'sequential-group',
    description: 'A group of sequential activities, all succeeding',
    events: [
      { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
      { type: 'activity:success', id: 'a1' },
      { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Bundle' },
      { type: 'activity:success', id: 'a2' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'buffered-activity-logs',
    description: 'Info logs emitted during activities, flushed after each completes',
    events: [
      {
        type: 'group:start',
        id: 'g1',
        label: 'Reconcile post-publish bookkeeping',
        layout: 'sequence',
      },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Repin root deps' },
      {
        type: 'log',
        activityId: 'a1',
        level: 'info',
        message: 'Root deps already pinned to latest published.',
      },
      { type: 'activity:success', id: 'a1' },
      { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Advance workspace versions' },
      {
        type: 'log',
        activityId: 'a2',
        level: 'info',
        message: 'All workspace versions already ahead of published.',
      },
      { type: 'activity:success', id: 'a2' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'mixed-log-levels',
    description: 'Every log level rendered outside any activity',
    events: [
      { type: 'group:start', id: 'g1', label: 'Levels', layout: 'sequence' },
      { type: 'log', level: 'info', message: 'An info message' },
      { type: 'log', level: 'warn', message: 'A warning message' },
      { type: 'log', level: 'error', message: 'An error message' },
      { type: 'log', level: 'success', message: 'A success message' },
      { type: 'log', level: 'step', message: 'A step message' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'activity-failure-remediation',
    description: 'A failing activity with remediation steps and a docs link',
    events: [
      { type: 'group:start', id: 'g1', label: 'Pre-flight checks', layout: 'sequence' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Docker running' },
      {
        type: 'activity:failure',
        id: 'a1',
        error: 'Docker daemon is not running',
        remediation: ['Start Docker Desktop, or', "Run 'sudo systemctl start docker' (Linux)"],
        documentationUrl: 'https://docs.docker.com/get-started/',
      },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'parallel-group',
    description: 'A parallel group where all activities succeed',
    events: [
      { type: 'group:start', id: 'g1', label: 'Checks', layout: 'parallel' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Lint' },
      { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Typecheck' },
      { type: 'activity:start', id: 'a3', parentId: 'g1', label: 'Test' },
      { type: 'activity:success', id: 'a1' },
      { type: 'activity:success', id: 'a2' },
      { type: 'activity:success', id: 'a3' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'parallel-group-failure',
    description: 'A parallel group with one failure; error deferred past the outro',
    events: [
      { type: 'group:start', id: 'g1', label: 'Checks', layout: 'parallel' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Lint' },
      { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Typecheck' },
      { type: 'activity:success', id: 'a1' },
      {
        type: 'activity:failure',
        id: 'a2',
        error: 'Found 3 type errors',
        remediation: ['Run pnpm tsc -b to see details'],
      },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'log-after-group',
    description: 'A log emitted after the group has closed (currently renders detached)',
    events: [
      { type: 'group:start', id: 'g1', label: 'Deploy', layout: 'sequence' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Push' },
      { type: 'activity:success', id: 'a1' },
      { type: 'group:end', id: 'g1' },
      { type: 'log', level: 'success', message: 'Deployment reconciled.' },
    ],
  },
  {
    name: 'two-groups',
    description: 'Two groups back to back, as pre/post lifecycle commands produce',
    events: [
      { type: 'group:start', id: 'g1', label: 'Publish', layout: 'sequence' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'npm publish' },
      { type: 'activity:success', id: 'a1' },
      { type: 'group:end', id: 'g1' },
      { type: 'group:start', id: 'g2', label: 'Post-publish', layout: 'sequence' },
      { type: 'activity:start', id: 'a2', parentId: 'g2', label: 'Repin deps' },
      { type: 'activity:success', id: 'a2' },
      { type: 'group:end', id: 'g2' },
    ],
  },
];
