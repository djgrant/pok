import { describe, it, expect } from 'bun:test';
import {
  createMenuNavigator,
  createRawReporterAdapter,
  createEventBus,
  createRootReporter,
  CancelError,
  type Prompter,
  type CLIEvent,
} from '../src';

function makeReporter(events: CLIEvent[]) {
  const bus = createEventBus();
  createRawReporterAdapter({ onEvent: (e) => events.push(e) }).start(bus);
  return createRootReporter(bus, 'app');
}

const basePrompter = (): Prompter => ({
  async select() {
    throw new Error('unused');
  },
  async multiselect() {
    return [];
  },
  async confirm() {
    return true;
  },
  async text() {
    return '';
  },
});

describe('createMenuNavigator', () => {
  it('returns a selection from the chosen option', async () => {
    const prompter = basePrompter();
    prompter.autocomplete = async () => 'b';
    const nav = createMenuNavigator(prompter);
    const events: CLIEvent[] = [];

    const result = await nav.choose({
      appName: 'app',
      path: [],
      message: 'pick',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      reporter: makeReporter(events),
    });

    expect(result).toEqual({ type: 'select', value: 'b' });
  });

  it('maps a cancelled prompt to back', async () => {
    const prompter = basePrompter();
    prompter.autocomplete = async () => {
      throw new CancelError('Cancelled');
    };
    const nav = createMenuNavigator(prompter);

    const result = await nav.choose({
      appName: 'app',
      path: ['parent'],
      message: 'pick',
      options: [{ value: 'x', label: 'X' }],
      reporter: makeReporter([]),
    });

    expect(result).toEqual({ type: 'back' });
  });

  it('emits a breadcrumb for non-root levels only', async () => {
    const prompter = basePrompter();
    prompter.autocomplete = async () => 'x';
    const nav = createMenuNavigator(prompter);

    const rootEvents: CLIEvent[] = [];
    await nav.choose({
      appName: 'app',
      path: [],
      message: 'pick',
      options: [{ value: 'x', label: 'X' }],
      reporter: makeReporter(rootEvents),
    });
    expect(rootEvents.some((e) => e.type === 'log' && e.message.includes(' > '))).toBe(false);

    const subEvents: CLIEvent[] = [];
    await nav.choose({
      appName: 'app',
      path: ['parent'],
      message: 'pick',
      options: [{ value: 'x', label: 'X' }],
      reporter: makeReporter(subEvents),
    });
    const breadcrumb = subEvents.find((e) => e.type === 'log' && e.message.includes(' > '));
    expect(breadcrumb && breadcrumb.type === 'log' && breadcrumb.message).toBe('app > parent');
  });

  it('falls back to select when autocomplete is unavailable', async () => {
    const prompter = basePrompter();
    let usedSelect = false;
    prompter.select = async () => {
      usedSelect = true;
      return 'only';
    };
    const nav = createMenuNavigator(prompter);

    const result = await nav.choose({
      appName: 'app',
      path: [],
      message: 'pick',
      options: [{ value: 'only', label: 'Only' }],
      reporter: makeReporter([]),
    });

    expect(usedSelect).toBe(true);
    expect(result).toEqual({ type: 'select', value: 'only' });
  });
});
