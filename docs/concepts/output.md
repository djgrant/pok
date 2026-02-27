# Structured Output

Commands can define an `output` schema that types the return value of `run()`. This enables automatic format routing, channel separation, and type-safe data pipelines.

## The output + format API

Define an `output` schema with Zod, and pok handles the rest:

```typescript
import { z } from 'zod';
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'List tasks',
  output: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(['todo', 'in-progress', 'done']),
    })),
    total: z.number(),
  }),
  format(data, r) {
    r.info(`Found ${data.total} tasks`);
    for (const t of data.tasks) {
      r.info(`  ${t.id}  ${t.title}  [${t.status}]`);
    }
  },
  run: async (_r, { context }) => {
    const tasks = await loadTasks();
    return { tasks, total: tasks.length };
  },
});
```

When `output` is defined:

- `run()` must return data matching the schema (enforced by TypeScript)
- The framework auto-handles output formatting via the `--format` flag
- Data goes to stdout (parsable), diagnostics go to stderr/event bus

## Channel Separation

Structured output enforces a clean split between data and diagnostics:

- **`run()` return value** → stdout (parsable data)
- **`r.reporter.info/warn/error`** → stderr/event bus (diagnostics, progress, warnings)

Commands should never call `console.log` directly for data output. Use the return value for data and the reporter for everything else.

```typescript
run: async (r) => {
  r.reporter.info('Fetching tasks...');   // stderr — progress
  r.reporter.warn('Cache is stale');      // stderr — diagnostic

  const tasks = await loadTasks();
  return { tasks, total: tasks.length };  // stdout — data
},
```

## Format Routing

When a command has an `output` schema, the `--format` flag controls how the return value is rendered:

### No `--format` flag

Calls the command's `format(data, reporter)` function for human-friendly display. If no `format` function is provided, falls back to JSON.

### `--format json`

Writes `JSON.stringify(result)` directly to stdout. Useful for piping:

```bash
mycli list --format json | jq '.tasks[] | select(.status == "done")'
```

### `--format table` / `--format csv`

Currently falls back to JSON. Auto-derivation from the schema is planned.

## The format Function

The `format` function receives two arguments:

- **`data`** — The typed data returned by `run()`, matching the output schema
- **`reporter`** — A `CommandReporter` with `.info()`, `.warn()`, `.error()` methods

The reporter routes through the event bus (typically to stderr via the reporter adapter), keeping stdout clean for parsable data.

```typescript
format(data, r) {
  if (data.total === 0) {
    r.warn('No tasks found');
    return;
  }
  for (const t of data.tasks) {
    r.info(`${t.id}  ${t.title}  [${t.status}]`);
  }
},
```

## When to Use output

Use `output` when your command produces data that should be:

- **Parsable by other tools** — `--format json | jq`
- **Displayable in multiple formats** — human, JSON, table
- **Type-safe end to end** — from schema to return type to formatter

Don't use `output` for commands that are purely side-effecting (deploying, building, etc.) — those should return void.

## Commands Without output

Commands without `output` work exactly as before — `run()` returns void, and all output goes through the reporter:

```typescript
export const command = defineCommand({
  label: 'Deploy',
  run: async (r) => {
    r.reporter.info('Deploying...');
    await r.exec('deploy');
    r.reporter.info('Done');
  },
});
```

No `--format` flag, no channel separation — just the reporter.

## Related

- [API Reference: defineCommand](../api/define-command.md)
- [CLI Flags](../cli-flags.md) — `--format` flag
- [Commands](./commands.md)
