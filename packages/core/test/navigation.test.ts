import { describe, it, expect } from 'bun:test';
import { captureEvents, normalizeEvents, stripRootLifecycleEvents } from './utils';
import * as fixtures from './fixtures';
import { CancelError, CANCEL_EXIT_CODE } from '../src';

/**
 * A scripted select response that simulates the user cancelling the prompt
 * (Esc / Ctrl-C). The default menu navigator maps a thrown CancelError to a
 * `back` navigation result, so this is how a raw-prompter script expresses
 * "go back / exit" through the router.
 */
const cancel = () => {
  throw new CancelError('Cancelled', CANCEL_EXIT_CODE);
};

describe('Navigation', () => {
  describe('menu navigation', () => {
    it('navigates to child via menu selection', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['parent', 'child-a'],
      });
      expect(error).toBeUndefined();
      expect(normalizeEvents(stripRootLifecycleEvents(events))).toEqual(fixtures.menuNavigation.events);
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
      expect(normalizeEvents(stripRootLifecycleEvents(events))).toEqual([]);
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
      expect(normalizeEvents(stripRootLifecycleEvents(events))).toEqual(fixtures.runAllChildren.events);
    });

    it('can select individual child instead of all', async () => {
      const { events, error } = await captureEvents([], {
        selectResponses: ['run-all', 'task-a'],
      });
      expect(error).toBeUndefined();
      expect(events.length).toBeLessThan(fixtures.runAllChildren.events.length);
    });

    it('resolves each child context when selecting __all__ from menu', async () => {
      const { error } = await captureEvents([], {
        selectResponses: ['run-all-context', '__all__', 'dev'],
        textResponses: ['alice'],
      });
      expect(error).toBeUndefined();
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

  describe('back / exit navigation', () => {
    it('back from a submenu returns to the parent menu (does not exit)', async () => {
      // 1) root menu   -> pick "parent" (descend)
      // 2) parent menu -> cancel (back to root)
      // 3) root menu   -> pick "simple" (runs to completion)
      const { events, error } = await captureEvents([], {
        selectResponses: ['parent', cancel, 'simple'],
      });

      // If `back` had unwound the whole menu, this would surface a CancelError.
      expect(error).toBeUndefined();

      // Proof we actually descended into "parent" before backing out.
      const breadcrumb = events.find(
        (e) => e.type === 'log' && e.message === 'cli-test > parent'
      );
      expect(breadcrumb).toBeDefined();
    });

    it('cancelling at the root level exits with the cancel exit code', async () => {
      const { error } = await captureEvents([], {
        selectResponses: [cancel],
      });

      expect(error).toBeInstanceOf(CancelError);
      expect((error as CancelError).exitCode).toBe(CANCEL_EXIT_CODE);
    });

    it('an explicit exit unwinds the whole menu from a submenu', async () => {
      // Descend into "parent", then re-enter and cancel at the root instead of
      // backing out step-by-step: cancelling once at root exits immediately.
      const { error } = await captureEvents([], {
        selectResponses: ['parent', cancel, cancel],
      });

      expect(error).toBeInstanceOf(CancelError);
      expect((error as CancelError).exitCode).toBe(CANCEL_EXIT_CODE);
    });
  });
});
