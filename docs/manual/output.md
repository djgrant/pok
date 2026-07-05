# Structured Output

Commands can define an `output` schema that types the value returned from `run()`. pok uses that schema to route data output, keep diagnostics out of stdout, and validate formatter input.

## The output + format API

Define an `output` schema with Zod and return data from `run()`:

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
- pok routes formatting through the `--format` flag
- Data goes to stdout and diagnostics go through the reporter event stream

## Channel Separation

Structured output splits machine-readable data from diagnostics:

- **`run()` return value** goes to stdout as parsable data.
- **`r.reporter.info/warn/error`** goes through the reporter event stream for diagnostics, progress, and warnings.

Commands should never call `console.log` directly for data output. Use the return value for data and the reporter for everything else.

```typescript
run: async (r) => {
  r.reporter.info('Fetching tasks...');   // stderr for progress
  r.reporter.warn('Cache is stale');      // stderr for diagnostics

  const tasks = await loadTasks();
  return { tasks, total: tasks.length };  // stdout for data
},
```

## Format Routing

When a command has an `output` schema, the `--format` flag controls how the return value is rendered:

### No `--format` flag

Calls the command's `format(data, reporter)` function for human-friendly display. If no `format` function is provided, falls back to JSON.

### `--format json`

Writes `JSON.stringify(result)` directly to stdout. This is the machine-readable path:

```bash
mycli list --format json | jq '.tasks[] | select(.status == "done")'
```

### `--format table` / `--format csv`

Currently falls back to JSON. Auto-derivation from the schema is planned.

## The format Function

The `format` function receives two arguments:

- **`data`**: the typed data returned by `run()`, matching the output schema.
- **`reporter`**: a `CommandReporter` with `.info()`, `.warn()`, and `.error()` methods.

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

Use `output` when your command returns data that should be:

- **Parsable by other tools**: `--format json | jq`
- **Displayable in multiple formats**: human, JSON, or table
- **Typed from schema to formatter**: the returned value and formatter input stay aligned

Do not use `output` for commands that only perform side effects such as deploys or builds. Those commands should return `void`.

## Commands Without output

Commands without `output` keep the original behavior. `run()` returns `void`, and all output goes through the reporter:

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

Without an `output` schema, there is no `--format` handling and the reporter owns all output.
