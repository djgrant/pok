# @pokit/core

`@pokit/core` contains the file-based router, command and task definitions, environment resolvers, event system, the prompter/reporter/navigator interfaces, the default menu navigator, and test adapters. It has zero TTY dependencies — terminal rendering lives in [@pokit/terminal](./terminal.md).

## Installation

```bash
bun add @pokit/core zod
```

## Exports

### Commands

```typescript
import { defineCommand } from '@pokit/core';
```

Define CLI commands with file-based routing, typed context, and pre-flight checks.

### Tasks

```typescript
import { defineTask } from '@pokit/core';
```

Create reusable units of work with environment requirements.

### Environments

```typescript
import { defineEnv, defineEnvResolver, defineCompositeResolver } from '@pokit/core';
```

Type-safe secret management with context-aware resolution.

### Checks

```typescript
import { defineCheck } from '@pokit/core';
```

Validate preconditions before command execution.

### Router

```typescript
import { run, runCli, buildCommandTree, fromDirectory, fromConfig, fromStatic } from '@pokit/core';
```

File-based command discovery and routing.

### Runner

```typescript
import { createRunner } from '@pokit/core';
```

Command execution engine with shell exec, task, and parallel support.

### Prompter & Navigator

```typescript
import { createRawPrompter, createMenuNavigator, isDynamicOptions } from '@pokit/core';
```

The interactive-input and menu-presentation contracts, plus the default menu
navigator. The terminal implementations live in [@pokit/terminal](./terminal.md).

### Events

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

  // Prompter & Navigator
  Prompter,
  SelectOptions,
  OptionsProvider,
  ConfirmOptions,
  TextOptions,
  Navigator,
  NavContext,
  NavResult,
} from '@pokit/core';
```

## Usage with Adapters

The core package is UI-agnostic. Terminal rendering and input come from
[@pokit/terminal](./terminal.md), which the `pok` launcher wires in automatically
for zero-config apps. To assemble it yourself:

```typescript
import { run } from '@pokit/core';
import { createTerminalUI } from '@pokit/terminal';

const { reporter, prompter, navigator } = createTerminalUI();

await run(process.argv.slice(2), {
  commandsDir: './commands',
  projectRoot: process.cwd(),
  prompter,
  reporterAdapter: reporter,
  navigator,
});
```

## API Reference

- [defineCommand](../api/define-command.md)
- [defineTask](../api/define-task.md)
- [defineEnv](../api/define-env.md)
- [defineCheck](../api/define-check.md)
- [Runner](../api/runner.md)
- [Router](../api/router.md)
- [Events](../api/events.md)
- [Prompter](../api/prompter.md)
- [Navigator](../api/navigator.md)
