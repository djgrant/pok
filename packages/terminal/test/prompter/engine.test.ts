/**
 * Prompt engine tests.
 *
 * Drives each widget through a fake stdin (PassThrough emitting keypresses)
 * and captures output in a buffer, so the full interaction loop — key
 * parsing, state transitions, frame redraws, cancel semantics — runs without
 * a TTY.
 */

import { describe, it, expect } from 'bun:test';
import { PassThrough, Writable } from 'node:stream';
import {
  CANCEL,
  SelectPrompt,
  MultiselectPrompt,
  ConfirmPrompt,
  TextPrompt,
  AutocompletePrompt,
} from '../../src/prompter/engine';

function makeIO() {
  const input = new PassThrough();
  const chunks: string[] = [];
  const output = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  return { input, output, text: () => chunks.join('') };
}

/** Send raw key sequences with microtask gaps so each keypress renders. */
async function press(input: PassThrough, ...sequences: string[]) {
  for (const seq of sequences) {
    input.write(seq);
    await new Promise((r) => setImmediate(r));
  }
}

const UP = '\x1b[A';
const DOWN = '\x1b[B';
const ENTER = '\r';
const SPACE = ' ';
const CTRL_C = '\x03';

const FRUIT = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', hint: 'yellow' },
  { value: 'cherry', label: 'Cherry' },
];

describe('SelectPrompt', () => {
  it('selects with arrows and enter', async () => {
    const { input, output } = makeIO();
    const promise = new SelectPrompt({ message: 'Pick', options: FRUIT, input, output }).prompt();
    await press(input, DOWN, ENTER);
    expect(await promise).toBe('banana');
  });

  it('wraps the cursor at both ends', async () => {
    const { input, output } = makeIO();
    const promise = new SelectPrompt({ message: 'Pick', options: FRUIT, input, output }).prompt();
    await press(input, UP, ENTER);
    expect(await promise).toBe('cherry');
  });

  it('honours initialValue', async () => {
    const { input, output } = makeIO();
    const promise = new SelectPrompt({
      message: 'Pick',
      options: FRUIT,
      initialValue: 'cherry',
      input,
      output,
    }).prompt();
    await press(input, ENTER);
    expect(await promise).toBe('cherry');
  });

  it('returns CANCEL on ctrl-c', async () => {
    const { input, output } = makeIO();
    const promise = new SelectPrompt({ message: 'Pick', options: FRUIT, input, output }).prompt();
    await press(input, CTRL_C);
    expect(await promise).toBe(CANCEL);
  });

  it('renders group headers', async () => {
    const { input, output, text } = makeIO();
    const promise = new SelectPrompt({
      message: 'Pick',
      options: [
        { value: 1, label: 'One', group: 'Numbers' },
        { value: 'a', label: 'Ay', group: 'Letters' },
      ],
      input,
      output,
    }).prompt();
    await press(input, ENTER);
    await promise;
    expect(text()).toContain('Numbers');
    expect(text()).toContain('Letters');
  });
});

describe('MultiselectPrompt', () => {
  it('toggles with space and submits with enter', async () => {
    const { input, output } = makeIO();
    const promise = new MultiselectPrompt({
      message: 'Pick many',
      options: FRUIT,
      input,
      output,
    }).prompt();
    await press(input, SPACE, DOWN, DOWN, SPACE, ENTER);
    expect(await promise).toEqual(['apple', 'cherry']);
  });

  it('respects initialValues', async () => {
    const { input, output } = makeIO();
    const promise = new MultiselectPrompt({
      message: 'Pick many',
      options: FRUIT,
      initialValues: ['banana'],
      input,
      output,
    }).prompt();
    await press(input, ENTER);
    expect(await promise).toEqual(['banana']);
  });

  it('blocks empty submit when required, then accepts', async () => {
    const { input, output, text } = makeIO();
    const promise = new MultiselectPrompt({
      message: 'Pick many',
      options: FRUIT,
      required: true,
      input,
      output,
    }).prompt();
    await press(input, ENTER);
    expect(text()).toContain('Select at least one option');
    await press(input, SPACE, ENTER);
    expect(await promise).toEqual(['apple']);
  });

  it('toggles all with a', async () => {
    const { input, output } = makeIO();
    const promise = new MultiselectPrompt({
      message: 'Pick many',
      options: FRUIT,
      input,
      output,
    }).prompt();
    await press(input, 'a', ENTER);
    expect(await promise).toEqual(['apple', 'banana', 'cherry']);
  });
});

describe('ConfirmPrompt', () => {
  it('defaults to no', async () => {
    const { input, output } = makeIO();
    const promise = new ConfirmPrompt({ message: 'Sure?', input, output }).prompt();
    await press(input, ENTER);
    expect(await promise).toBe(false);
  });

  it('toggles with arrows', async () => {
    const { input, output } = makeIO();
    const promise = new ConfirmPrompt({ message: 'Sure?', input, output }).prompt();
    await press(input, UP, ENTER);
    expect(await promise).toBe(true);
  });

  it('accepts y/n shortcuts', async () => {
    const { input, output } = makeIO();
    const promise = new ConfirmPrompt({ message: 'Sure?', input, output }).prompt();
    await press(input, 'y');
    expect(await promise).toBe(true);
  });
});

describe('TextPrompt', () => {
  it('captures typed input', async () => {
    const { input, output } = makeIO();
    const promise = new TextPrompt({ message: 'Name?', input, output }).prompt();
    await press(input, 'h', 'i', ENTER);
    expect(await promise).toBe('hi');
  });

  it('supports backspace and cursor movement', async () => {
    const { input, output } = makeIO();
    const promise = new TextPrompt({ message: 'Name?', input, output }).prompt();
    // "abc", backspace -> "ab", left, insert "x" -> "axb"
    await press(input, 'a', 'b', 'c', '\x7f', '\x1b[D', 'x', ENTER);
    expect(await promise).toBe('axb');
  });

  it('shows validation errors and blocks submit', async () => {
    const { input, output, text } = makeIO();
    const promise = new TextPrompt({
      message: 'Name?',
      validate: (v) => (v.length < 2 ? 'Too short' : undefined),
      input,
      output,
    }).prompt();
    await press(input, 'a', ENTER);
    expect(text()).toContain('Too short');
    await press(input, 'b', ENTER);
    expect(await promise).toBe('ab');
  });

  it('starts from initialValue', async () => {
    const { input, output } = makeIO();
    const promise = new TextPrompt({ message: 'Name?', initialValue: 'dan', input, output }).prompt();
    await press(input, ENTER);
    expect(await promise).toBe('dan');
  });
});

describe('AutocompletePrompt', () => {
  it('filters as the user types', async () => {
    const { input, output, text } = makeIO();
    const promise = new AutocompletePrompt({
      message: 'Pick',
      options: FRUIT,
      input,
      output,
    }).prompt();
    await press(input, 'b', 'a', 'n');
    expect(text()).toContain('1 match');
    await press(input, ENTER);
    expect(await promise).toBe('banana');
  });

  it('matches on hints too', async () => {
    const { input, output } = makeIO();
    const promise = new AutocompletePrompt({
      message: 'Pick',
      options: FRUIT,
      input,
      output,
    }).prompt();
    await press(input, 'y', 'e', 'l', ENTER);
    expect(await promise).toBe('banana');
  });

  it('shows no-matches state and recovers on backspace', async () => {
    const { input, output, text } = makeIO();
    const promise = new AutocompletePrompt({
      message: 'Pick',
      options: FRUIT,
      input,
      output,
    }).prompt();
    await press(input, 'z', 'z');
    expect(text()).toContain('No matches found');
    await press(input, '\x7f', '\x7f', DOWN, ENTER);
    expect(await promise).toBe('banana');
  });

  it('wraps navigation within filtered results', async () => {
    const { input, output } = makeIO();
    const promise = new AutocompletePrompt({
      message: 'Pick',
      options: FRUIT,
      input,
      output,
    }).prompt();
    await press(input, UP, ENTER);
    expect(await promise).toBe('cherry');
  });
});
