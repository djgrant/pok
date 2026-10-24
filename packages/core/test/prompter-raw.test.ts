/**
 * Tests for the raw prompter's password prompt
 */

import { describe, it, expect } from 'bun:test';
import { createRawPrompter } from '../src';

describe('createRawPrompter password', () => {
  it('returns configured responses in order and records calls', async () => {
    const prompter = createRawPrompter({ passwordResponses: ['first', 'second'] });
    expect(await prompter.password({ message: 'Token?' })).toBe('first');
    expect(await prompter.password({ message: 'Again?', mask: '#' })).toBe('second');
    expect(prompter.getCalls()).toMatchObject([
      { type: 'password', options: { message: 'Token?' }, response: 'first' },
      { type: 'password', options: { message: 'Again?', mask: '#' }, response: 'second' },
    ]);
  });

  it('defaults to an empty string', async () => {
    const prompter = createRawPrompter();
    expect(await prompter.password({ message: 'Token?' })).toBe('');
  });
});
