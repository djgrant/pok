# @openpok/core

The core pok framework. Zero TTY dependencies—all terminal features come from adapters.

## Installation

```bash
bun add @openpok/core zod
```

## What's Included

### Command System

```typescript
import { defineCommand } from '@openpok/core';
```

Define CLI commands with file-based routing, typed context, and pre-flight checks.

### Task System

```typescript
import { defineTask } from '@openpok/core';
```

Create reusable units of work with environment requirements.

### Environment System

```typescript
import { defineEnv, defineEnvResolver, defineCompositeResolver } from '@openpok/core';
```

Type-safe secret management with context-aware resolution.

### Pre-flight Checks

```typescript
import { defineCheck } from '@openpok/core';
```

Validate preconditions before command execution.

### Router

```typescript
import { run, buildCommandTree } from '@openpok/core';
```

File-based command discovery and routing.

### Runner

```typescript
import { createRunner } from '@openpok/core';
```

Command execution engine with shell, parallel, and tabs support.

### Event System

```typescript
import {
  createEventBus,
  ScopedReporter,
  createRawReporterAdapter,
} from '@openpok/core';
```

Event-driven architecture for decoupled output.

### Shell Utilities

```typescript
import {
  commandExists,
  getVersion,
  getNodeMajorVersion,
  getPackageManager,
} from '@openpok/core';
```

Helpers for shell operations and environment checks.

### Raw Adapters (Testing)

```typescript
import {
  createRawPrompter,
  createRawReporterAdapter,
} from '@openpok/core';
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
} from '@openpok/core';
```

## Usage with Adapters

The core package requires adapters for terminal features:

```typescript
import { run } from '@openpok/core';
import { createPrompter } from '@openpok/prompter-clack';
import { createReporterAdapter } from '@openpok/reporter-clack';
import { createTabsAdapter } from '@openpok/tabs-ink';

await run(process.argv.slice(2), {
  commandsDir: './commands',
  projectRoot: process.cwd(),
  prompter: createPrompter(),
  reporterAdapter: createReporterAdapter(),
  tabs: createTabsAdapter(),
});
```

## Related Packages

| Package | Purpose |
|---------|---------|
| `@openpok/prompter-clack` | Interactive prompts |
| `@openpok/reporter-clack` | Terminal output |
| `@openpok/tabs-ink` | Tabbed terminal UI |
| `@openpok/tabs-core` | Shared tabs logic |
| `@openpok/create` | Project scaffolding |

## API Reference

- [defineCommand](../api/define-command.md)
- [defineTask](../api/define-task.md)
- [defineEnv](../api/define-env.md)
- [defineCheck](../api/define-check.md)
- [Runner](../api/runner.md)
- [Router](../api/router.md)
- [Events](../api/events.md)
