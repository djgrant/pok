# Runner

The Runner is the execution engine for commands. It provides methods for running shell commands, tasks, parallel execution, and tabbed terminals.

## Import

The Runner is provided to command `run` functions—you don't import it directly.

```typescript
defineCommand({
  run: async (r, ctx) => {
    // r is the Runner
  },
});
```

## Interface

```typescript
interface Runner<TContext> {
  cwd: string;
  reporter: CommandReporter;
  prompter: Prompter;

  exec(cmd: ExecInput, opts?: ExecOptions): Command;
  run<TReturn>(task: AnyTaskConfig, params?: Record<string, unknown>): DeferredTask<TReturn>;
  parallel(items: RunnerItem[], options?: ParallelOptions): Promise<void>;
  tabs(items: RunnerItem[], options?: TabsRunnerOptions): Promise<void>;
  app<TProps>(
    component: AnyComponent<TProps>,
    props: TProps
  ): Promise<void>;
  group<T>(
    label: string,
    options: GroupOptions,
    fn: (reporter: Reporter) => Promise<T> | T
  ): Promise<T>;
}
```

## Properties

### cwd

```typescript
cwd: string;
```

The project root directory. Use this for file operations:

```typescript
run: async (r) => {
  const configPath = path.join(r.cwd, 'config.json');
};
```

### reporter

```typescript
reporter: CommandReporter;
```

Event emission for logging and progress updates:

```typescript
run: async (r) => {
  r.reporter.info('Starting...');
  r.reporter.warn('This might take a while');
  r.reporter.error('Something went wrong');
  r.reporter.success('Done!');
};
```

## Methods

### exec

Execute a shell command.

```typescript
exec(cmd: ExecInput, opts?: ExecOptions): Command

type ExecInput = string | string[] | ShellPromise;

type ExecOptions = {
  timeout?: number;  // Override default timeout
  retry?: RetryConfig;  // Retry configuration
};

type RetryConfig = {
  maxAttempts: number;  // Retry attempts (not including initial)
  delay?: number;       // Base delay in ms (default: 1000)
  backoff?: 'fixed' | 'linear' | 'exponential';  // Default: 'fixed'
  maxDelay?: number;    // Cap for backoff growth
};
```

Returns a `Command` that is thenable (can be awaited):

```typescript
run: async (r) => {
  // Simple execution
  await r.exec('npm install');

  // With timeout
  await r.exec('npm test', { timeout: 60000 });

  // With retry on failure
  await r.exec('curl https://flaky-api.com', {
    retry: { maxAttempts: 3, delay: 1000, backoff: 'exponential' },
  });

  // Array form (no shell interpolation, safe for dynamic input)
  await r.exec(['git', 'checkout', branchName]);
};
```

### run

Execute a task with optional parameters.

```typescript
run<TReturn>(task: AnyTaskConfig, params?: Record<string, unknown>): DeferredTask<TReturn>
```

Returns a `DeferredTask` that is thenable:

```typescript
import { buildTask, deployTask } from '../tasks';

run: async (r) => {
  // Execute task
  await r.run(buildTask);

  // With parameters
  await r.run(deployTask, { env: 'staging' });

  // Get return value
  const version = await r.run(getVersionTask);
};
```

### parallel

Run multiple commands/tasks in parallel with configurable execution modes.

```typescript
parallel(items: RunnerItem[], options?: ParallelOptions): Promise<void>

type ParallelMode = 'race' | 'fail-fast' | 'all-settled';

type ParallelOptions = {
  mode?: ParallelMode;  // Default: 'race'
};
```

#### Execution Modes

| Mode          | Behavior                                                  |
| ------------- | --------------------------------------------------------- |
| `race`        | First to settle wins, cancel rest (default)               |
| `fail-fast`   | First failure cancels rest, otherwise wait for all        |
| `all-settled` | Run all to completion, throw `AggregateError` if any fail |

```typescript
run: async (r) => {
  // Race mode (default) - exits when first completes
  await r.parallel([r.exec('npm run dev'), r.exec('npm run watch')]);

  // Fail-fast mode - all must succeed, abort on first failure
  await r.parallel([r.run(buildTask), r.run(testTask), r.run(lintTask)], { mode: 'fail-fast' });

  // All-settled mode - run all, collect failures
  await r.parallel([r.run(deploy1), r.run(deploy2), r.run(deploy3)], { mode: 'all-settled' });
};
```

#### Retry Interaction

Tasks with retry configuration will exhaust all retries before the parallel mode rules apply:

````typescript
const flakyTask = defineTask({
  label: 'Flaky API call',
  retry: { maxAttempts: 3, delay: 1000, backoff: 'exponential' },
  exec: 'curl https://api.example.com/flaky',
});

// In fail-fast mode: flakyTask retries up to 3 times before
// being considered a failure that triggers cancellation
await r.parallel([r.run(flakyTask), r.run(stableTask)], { mode: 'fail-fast' });

### tabs

Run multiple commands/tasks in a tabbed terminal interface.

```typescript
tabs(items: RunnerItem[], options?: TabsRunnerOptions): Promise<void>

type TabsRunnerOptions = {
  name?: string;  // Console name (e.g., "Development")
};
````

Requires a tabs adapter (e.g., `@pokit/opentui`):

```typescript
run: async (r) => {
  await r.tabs([r.exec('npm run dev'), r.exec('stripe listen'), r.run(watchTask)], {
    name: 'Development',
  });
};
```

Features:

- Each tab shows buffered output
- Keyboard navigation between tabs
- Scrollable output history
- Process lifecycle management

### app

Run a fullscreen interactive app component.

```typescript
app<TProps>(
  component: AnyComponent<TProps>,
  props: TProps
): Promise<void>
```

Requires an app adapter (e.g., `@pokit/opentui`):

```typescript
run: async (r) => {
  await r.app(MyExplorer, {
    data: await loadData(r.cwd),
    onSave: async (id, fields) => { /* persist */ },
  });
},
```

The component is a standard React function component that:
- Owns its own state via hooks
- Handles keyboard input via `useKeyboard`
- Can use optional `onExit()` to close and return control

See [App Adapter](./app.md) for full details.

### group

Create a visual group for organizing activities.

```typescript
group<T>(
  label: string,
  options: GroupOptions,
  fn: (reporter: Reporter) => Promise<T> | T
): Promise<T>

type GroupOptions = {
  layout: 'sequence' | 'parallel' | 'tabs' | 'grid';
};
```

```typescript
run: async (r) => {
  await r.group('Database Setup', { layout: 'sequence' }, async (g) => {
    await g.activity('Run migrations', async () => {
      await r.exec('prisma migrate deploy');
    });

    await g.activity('Seed data', async () => {
      await r.exec('prisma db seed');
    });
  });
};
```

## Reporter Methods

The `reporter` property provides logging:

```typescript
interface CommandReporter {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  step(message: string): void;

  group<T>(label: string, options: GroupOptions, fn: (r: Reporter) => T): Promise<T>;
  activity<T>(label: string, fn: () => T): Promise<T>;

  suspend(): void; // Suspend output (for TUI takeover)
  resume(): void; // Resume output
}
```

## Error Handling

### CommandError

Thrown when a command fails, includes captured output:

```typescript
import { CommandError } from '@pokit/core';

run: async (r) => {
  try {
    await r.exec('npm test');
  } catch (error) {
    if (error instanceof CommandError) {
      console.log('Output:', error.output);
    }
  }
};
```

### AbortError

Thrown when execution is cancelled via AbortSignal:

```typescript
import { AbortError } from '@pokit/core';

// This is handled internally - commands can be cancelled
// when running in parallel mode and another command fails
```

## Environment Variables

Resolved environment variables are automatically injected into shell commands:

```typescript
const dbTask = defineTask({
  env: dbEnv, // Resolves DATABASE_URL
  exec: 'prisma migrate deploy', // DATABASE_URL available
});

run: async (r) => {
  await r.run(dbTask);
  // After dbTask, DATABASE_URL is cached and available
  // in subsequent exec calls
  await r.exec('psql $DATABASE_URL -c "SELECT 1"');
};
```

## Process Management

pok handles process lifecycle:

- **Signal handlers** - SIGINT/SIGTERM cleanup
- **Process tracking** - All spawned processes tracked
- **Automatic cleanup** - Processes killed on exit
- **Parallel race** - First exit kills siblings

## Examples

### Complete Command

```typescript
import { defineCommand } from '@pokit/core';
import { buildTask, testTask, deployTask } from '../tasks';
import { dockerRunning } from '../checks';

export const command = defineCommand({
  label: 'Deploy to production',
  pre: [dockerRunning],
  run: async (r) => {
    await r.group('Build', { layout: 'sequence' }, async (g) => {
      await g.activity('Compile', () => r.run(buildTask));
      await g.activity('Test', () => r.run(testTask));
    });

    r.reporter.info('Deploying...');
    await r.run(deployTask, { env: 'prod' });
    r.reporter.success('Deployed!');
  },
});
```

### Development Mode

```typescript
export const command = defineCommand({
  label: 'Start development',
  run: async (r) => {
    await r.tabs(
      [
        r.exec('npm run dev'),
        r.exec('npm run watch:css'),
        r.exec('stripe listen --forward-to localhost:3000/webhooks'),
      ],
      { name: 'Dev' }
    );
  },
});
```

## Related

- [defineCommand](./define-command.md) - Command definitions
- [defineTask](./define-task.md) - Task definitions
- [App Adapter](./app.md) - Fullscreen TUI apps
- [Tabs Adapter](./tabs.md) - Tabbed terminal UI
- [Events](./events.md) - Reporter event system
