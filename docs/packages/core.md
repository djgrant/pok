# @pokit/core

The core pok framework. Zero TTY dependencies—all terminal features come from adapters.

## Installation

```bash
bun add @pokit/core zod
```

## What's Included

### Command System

```typescript
import { defineCommand } from '@pokit/core';
```

Define CLI commands with file-based routing, typed context, and pre-flight checks.

### Task System

```typescript
import { defineTask } from '@pokit/core';
```

Create reusable units of work with environment requirements.

### Environment System

```typescript
import { defineEnv, defineEnvResolver, defineCompositeResolver } from '@pokit/core';
```

Type-safe secret management with context-aware resolution.

### Pre-flight Checks

```typescript
import { defineCheck } from '@pokit/core';
```

Validate preconditions before command execution.

### Router

```typescript
import { run, buildCommandTree, fromDirectory, fromConfig, fromObject } from '@pokit/core';
```

File-based command discovery and routing.

File-based command discovery and routing.

### Runner

```typescript
import { createRunner } from '@pokit/core';
```

Command execution engine with shell, parallel, and tabs support.

### Event System

```typescript
import { createEventBus, ScopedReporter, createRawReporterAdapter } from '@pokit/core';
```

Event-driven architecture for decoupled output.

### Shell Utilities

```typescript
import { commandExists, getVersion, getNodeMajorVersion, getPackageManager } from '@pokit/core';
```

Helpers for shell operations and environment checks.

### History Utilities

```typescript
import { loadHistory, clearHistory, formatEntryLabel } from '@pokit/core';
```

Utilities for managing command execution history.

### Raw Adapters (Testing)

```typescript
import { createRawPrompter, createRawReporterAdapter } from '@pokit/core';
```

Test-friendly implementations with no TTY dependencies.

## Types

All types are exported:

```typescript
import type {
  // Commands
  CommandConfig,
  ContextDef,
  RunContext,
  RunFn,

  // Tasks
  ExecTaskConfig,
  RunTaskConfig,
  TaskContext,

  // Environment
  Env,
  EnvResolver,

  // Checks
  CheckConfig,

  // Runner
  Runner,
  ExecOptions,

  // Router
  RouterConfig,

  // Events
  CLIEvent,
  EventBus,
  Reporter,
  ReporterAdapter,

  // Prompter
  Prompter,
  SelectOptions,
  ConfirmOptions,
  TextOptions,

  // Tabs
  TabsAdapter,
  TabSpec,
} from '@pokit/core';
```

## Usage with Adapters

The core package requires adapters for terminal features:

```typescript
import { run } from '@pokit/core';
import { createPrompter } from '@pokit/prompter-clack';
import { createReporterAdapter } from '@pokit/reporter-clack';
import { createTabsAdapter } from '@pokit/tabs-ink';

await run(process.argv.slice(2), {
  commandsDir: './commands',
  projectRoot: process.cwd(),
  prompter: createPrompter(),
  reporterAdapter: createReporterAdapter(),
  tabs: createTabsAdapter(),
});
```

## Related Packages

| Package                 | Purpose             |
| ----------------------- | ------------------- |
| `@pokit/prompter-clack` | Interactive prompts |
| `@pokit/reporter-clack` | Terminal output     |
| `@pokit/tabs-ink`       | Tabbed terminal UI  |
| `@pokit/tabs-core`      | Shared tabs logic   |
| `create-pokit`          | Project scaffolding |

## API Reference

- [defineCommand](../api/define-command.md)
- [defineTask](../api/define-task.md)
- [defineEnv](../api/define-env.md)
- [defineCheck](../api/define-check.md)
- [Runner](../api/runner.md)
- [Router](../api/router.md)
- [Events](../api/events.md)
