import { describe, it, expect } from 'bun:test';
import { captureEvents, normalizeEvents } from './utils';
import * as fixtures from './fixtures';

describe('Commands', () => {
  describe('simple command', () => {
    it('emits no events for basic r.exec()', async () => {
      const { events } = await captureEvents(['simple']);
      expect(normalizeEvents(events)).toEqual(fixtures.simpleCommand.events);
    });

    it('executes without errors', async () => {
      const { error } = await captureEvents(['simple']);
      expect(error).toBeUndefined();
    });
  });

  describe('command with context', () => {
    it('runs with default flag values', async () => {
      const { events, error } = await captureEvents(['with-context']);
      expect(error).toBeUndefined();
      expect(normalizeEvents(events)).toEqual(
        fixtures.commandWithContext.events
      );
    });

    it('runs with explicit --env flag', async () => {
      const { events, error } = await captureEvents([
        'with-context',
        '--env',
        'staging',
      ]);
      expect(error).toBeUndefined();
      expect(normalizeEvents(events)).toEqual(
        fixtures.commandWithContext.events
      );
    });

    it('runs with --verbose flag', async () => {
      const { events, error } = await captureEvents([
        'with-context',
        '--verbose',
      ]);
      expect(error).toBeUndefined();
      expect(normalizeEvents(events)).toEqual(
        fixtures.commandWithContext.events
      );
    });

    it('runs with multiple flags', async () => {
      const { events, error } = await captureEvents([
        'with-context',
        '--env',
        'prod',
        '--verbose',
      ]);
      expect(error).toBeUndefined();
      expect(normalizeEvents(events)).toEqual(
        fixtures.commandWithContext.events
      );
    });
  });

  describe('command with tasks', () => {
    it('runs tasks in sequence', async () => {
      const { error } = await captureEvents(['with-tasks']);
      expect(error).toBeUndefined();
    });

    it('passes parameters to tasks', async () => {
      const { error } = await captureEvents(['with-tasks', '--env', 'staging']);
      expect(error).toBeUndefined();
    });
  });
});
