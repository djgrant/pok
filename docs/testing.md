# Testing Guide

This guide covers testing patterns for pok CLI applications, including unit testing commands, mocking environments, and end-to-end testing.

## Overview

pok provides test utilities that allow you to:

- Run commands without terminal output
- Capture and assert on emitted events
- Mock interactive prompts with pre-configured responses
- Test environment resolvers in isolation

## Core Testing Utilities

### createRawPrompter

A non-interactive prompter for testing. Pre-configure responses instead of requiring user input.

```typescript
import { createRawPrompter } from '@pokjs/core';

// Simple usage - uses sensible defaults
const prompter = createRawPrompter();

// Pre-configured responses
const prompter = createRawPrompter({
  selectResponses: ['option1', 'option2'], // consumed in order
  confirmResponses: true, // always true
  textResponses: (opts) => opts.initialValue ?? 'test',
});

// After running commands, inspect what prompts were shown
const calls = prompter.getCalls();
expect(calls[0]).toMatchObject({ type: 'select', response: 'option1' });
```

#### Options

| Option                 | Type                                          | Description                        |
| ---------------------- | --------------------------------------------- | ---------------------------------- |
| `selectResponses`      | `T \| T[] \| ((opts) => T)`                   | Responses for select prompts       |
| `multiselectResponses` | `T[] \| T[][] \| ((opts) => T[])`             | Responses for multiselect prompts  |
| `confirmResponses`     | `boolean \| boolean[] \| ((opts) => boolean)` | Responses for confirm prompts      |
| `textResponses`        | `string \| string[] \| ((opts) => string)`    | Responses for text prompts         |
| `strict`               | `boolean`                                     | Throw if no response is configured |
| `onPrompt`             | `(call) => void`                              | Callback fired for each prompt     |

#### Response Patterns

```typescript
// Single value - used for all prompts of that type
createRawPrompter({ confirmResponses: true });

// Array - consumed in order
createRawPrompter({
  selectResponses: ['first', 'second', 'third'],
});

// Function - dynamic based on prompt options
createRawPrompter({
  selectResponses: (opts) => opts.options[0]?.value,
});
```

### createRawReporterAdapter

A minimal reporter that captures events without terminal output.

```typescript
import { createRawReporterAdapter } from '@pokjs/core';

const events: CLIEvent[] = [];
const reporterAdapter = createRawReporterAdapter({
  onEvent: (event) => events.push(event),
});

// Use with run()
await run(['my-command'], {
  commandsDir: './commands',
  reporterAdapter,
});

// Assert on captured events
expect(events).toContainEqual(expect.objectContaining({ type: 'activity:success' }));
```

#### Controller Methods

```typescript
const controller = reporterAdapter.start(eventBus);

// Get all captured events
const events = controller.getEvents();

// Clear events between tests
controller.clearEvents();

// Stop capturing
controller.stop();
```

## Testing Commands End-to-End

### Basic Pattern

```typescript
import { describe, it, expect } from 'bun:test';
import { run, createRawReporterAdapter, createRawPrompter } from '@pokjs/core';

describe('my-command', () => {
  it('runs successfully', async () => {
    const events: CLIEvent[] = [];
    const reporterAdapter = createRawReporterAdapter({
      onEvent: (event) => events.push(event),
    });
    const prompter = createRawPrompter();

    await run(['my-command'], {
      commandsDir: './commands',
      projectRoot: process.cwd(),
      appName: 'test-cli',
      reporterAdapter,
      prompter,
    });

    // Assert command completed
    const groupEnd = events.find((e) => e.type === 'group:end');
    expect(groupEnd).toBeDefined();
  });
});
```

### Testing with Flags

```typescript
it('respects --env flag', async () => {
  const events: CLIEvent[] = [];
  const reporterAdapter = createRawReporterAdapter({
    onEvent: (event) => events.push(event),
  });

  await run(['deploy', '--env', 'staging'], {
    commandsDir: './commands',
    reporterAdapter,
    prompter: createRawPrompter(),
  });

  // Assert staging environment was used
  const logs = events.filter((e) => e.type === 'log');
  expect(logs.some((l) => l.message.includes('staging'))).toBe(true);
});
```

### Testing Interactive Prompts

```typescript
it('navigates menu correctly', async () => {
  const prompter = createRawPrompter({
    selectResponses: ['deploy', 'production'],
  });

  await run([], {
    commandsDir: './commands',
    reporterAdapter: createRawReporterAdapter(),
    prompter,
  });

  // Verify prompts were shown
  const calls = prompter.getCalls();
  expect(calls).toHaveLength(2);
  expect(calls[0].type).toBe('select');
});
```

## Mocking Environment Resolvers

For testing commands that use environment variables, create mock resolvers.

### Creating a Mock Resolver

```typescript
import { z } from 'zod';
import { defineEnvResolver } from '@pokjs/core';

export const mockResolver = defineEnvResolver({
  requiredContext: z.object({
    env: z.enum(['dev', 'staging', 'prod']),
  }),
  availableVars: ['API_KEY', 'DATABASE_URL'] as const,
  resolve: (keys, ctx) => {
    // Return predictable mock values
    return Object.fromEntries(keys.map((k) => [k, `mock-${k.toLowerCase()}-${ctx.env}`]));
  },
});
```

### Using Mock Environments in Tests

```typescript
import { defineEnv } from '@pokjs/core';
import { mockResolver } from './mocks/resolver';

// Create a mock environment
const mockEnv = defineEnv({
  resolver: mockResolver,
  vars: ['API_KEY', 'DATABASE_URL'],
});

// Use in command definition for testing
const testCommand = defineCommand({
  meta: { description: 'Test command' },
  context: {
    env: {
      from: 'flag',
      schema: z.enum(['dev', 'staging', 'prod']),
      default: 'dev',
    },
  },
  envs: { mock: mockEnv },
  run: async ({ ctx, r, envs }) => {
    // envs.mock will use the mock resolver
    const vars = await envs.mock.resolve(ctx);
    r.log.info(`API_KEY: ${vars.API_KEY}`);
  },
});
```

### Simple Resolver (No Context)

```typescript
export const simpleResolver = defineEnvResolver({
  requiredContext: z.object({}),
  availableVars: ['SIMPLE_VAR'] as const,
  resolve: (keys) => {
    return Object.fromEntries(keys.map((k) => [k, `simple-${k.toLowerCase()}`]));
  },
});
```

## Event Normalization

When comparing events across test runs, use normalization to handle dynamic IDs and timestamps.

```typescript
import { normalizeEvents, filterEvents, eventTypes } from '@pokjs/test-utils';

// Normalize removes dynamic values (ids, timestamps)
const normalized = normalizeEvents(events);

// Filter to specific event types
const activities = filterEvents(events, ['activity:start', 'activity:success']);

// Get just the event types in order
const types = eventTypes(events);
// ['group:start', 'activity:start', 'activity:success', 'group:end']
```

## Testing Patterns

### Capture Helper Pattern

Create a reusable helper for your test suite:

```typescript
// test/utils/capture.ts
import { run, createRawReporterAdapter, createRawPrompter, type CLIEvent } from '@pokjs/core';

export async function captureEvents(args: string[], options: { selectResponses?: unknown[] } = {}) {
  const events: CLIEvent[] = [];
  const reporterAdapter = createRawReporterAdapter({
    onEvent: (event) => events.push(event),
  });
  const prompter = createRawPrompter({
    selectResponses: options.selectResponses,
  });

  let error: Error | undefined;

  try {
    await run(args, {
      commandsDir: './commands',
      projectRoot: process.cwd(),
      appName: 'test-cli',
      reporterAdapter,
      prompter,
    });
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  }

  return { events, error };
}

// Usage
const { events, error } = await captureEvents(['deploy', '--env', 'prod']);
expect(error).toBeUndefined();
```

### Fixture-Based Testing

Compare events against known-good fixtures:

```typescript
// test/fixtures/deploy.ts
export const deployCommand = {
  events: [
    { type: 'group:start', label: 'Deploy' },
    { type: 'activity:start', label: 'Deploying...' },
    { type: 'activity:success' },
    { type: 'group:end' },
  ],
};

// test/deploy.test.ts
import * as fixtures from './fixtures';

it('emits expected events', async () => {
  const { events } = await captureEvents(['deploy']);
  expect(normalizeEvents(events)).toEqual(fixtures.deployCommand.events);
});
```

### Error Testing

```typescript
it('handles errors gracefully', async () => {
  const { events, error } = await captureEvents(['failing-command']);

  expect(error).toBeDefined();
  expect(error?.message).toContain('expected error message');

  // Check failure event was emitted
  const failure = events.find((e) => e.type === 'activity:failure');
  expect(failure).toBeDefined();
});
```

## Best Practices

1. **Isolate tests** - Each test should set up its own prompter and reporter
2. **Use strict mode** - Enable `strict: true` on prompter to catch missing responses
3. **Normalize for comparison** - Always normalize events before comparing
4. **Test edge cases** - Include tests for missing flags, invalid input, and errors
5. **Mock external calls** - Use mock resolvers for environment variables and API calls
6. **Capture all events** - Don't filter events in capture, filter in assertions
