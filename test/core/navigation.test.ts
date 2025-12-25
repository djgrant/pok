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

  describe('breadcrumbs', () => {
    it('shows breadcrumb when navigating into submenu', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['parent', 'child-a'],
      });
      expect(error).toBeUndefined();

      // Find breadcrumb event
      const breadcrumbEvent = events.find(
        (e) => e.type === 'log' && e.level === 'info' && e.message?.includes(' > ')
      );
      expect(breadcrumbEvent).toBeDefined();
      expect(breadcrumbEvent?.type === 'log' && breadcrumbEvent.message).toBe('cli-test > parent');
    });

    it('does not show breadcrumb at root level', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['simple'],
      });
      expect(error).toBeUndefined();

      // Should have no breadcrumb events (no submenus for leaf commands)
      const breadcrumbEvents = events.filter(
        (e) => e.type === 'log' && e.level === 'info' && e.message?.includes(' > ')
      );
      expect(breadcrumbEvents.length).toBe(0);
    });

    it('formats breadcrumb with app name and path', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['run-all', 'task-a'],
      });
      expect(error).toBeUndefined();

      // Find breadcrumb event
      const breadcrumbEvent = events.find(
        (e) => e.type === 'log' && e.level === 'info' && e.message?.includes(' > ')
      );
      expect(breadcrumbEvent).toBeDefined();
      expect(breadcrumbEvent?.type === 'log' && breadcrumbEvent.message).toBe('cli-test > run-all');
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
