import { describe, it, expect } from 'bun:test';
import { captureEvents, normalizeEvents } from './utils';
import * as fixtures from './fixtures';

describe('Navigation', () => {
  describe('menu navigation', () => {
    it('navigates to child via menu selection', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['parent', 'child-a'],
      });
      expect(error).toBeUndefined();
      expect(normalizeEvents(events)).toEqual(fixtures.menuNavigation.events);
    });

    it('navigates through multiple menu levels', async () => {
      const { error } = await captureEvents([], {
        selectResponses: ['parent', 'child-b'],
      });
      expect(error).toBeUndefined();
    });
  });

  describe('direct execution', () => {
    it('runs child directly via args (no menu events)', async () => {
      const { events, error } = await captureEvents(['parent', 'child-a']);
      expect(error).toBeUndefined();
      expect(normalizeEvents(events)).toEqual([]);
    });

    it('runs nested command directly', async () => {
      const { error } = await captureEvents(['parent', 'child-b']);
      expect(error).toBeUndefined();
    });
  });

  describe('run all children', () => {
    it('executes all children sequentially with __all__', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['run-all', '__all__'],
      });
      expect(error).toBeUndefined();
      expect(normalizeEvents(events)).toEqual(fixtures.runAllChildren.events);
    });

    it('can select individual child instead of all', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['run-all', 'task-a'],
      });
      expect(error).toBeUndefined();
      expect(events.length).toBeLessThan(fixtures.runAllChildren.events.length);
    });
  });

  describe('parent commands', () => {
    it('shows menu when parent has no run function', async () => {
      const { error } = await captureEvents([], {
        selectResponses: ['parent', 'child-a'],
      });
      expect(error).toBeUndefined();
    });
  });
});
