# Architecture

pok is a command router, execution runner, event bus, and adapter layer for TypeScript CLIs. The core package builds command trees, validates context, runs commands and tasks, resolves environments, and emits semantic events that adapters render.

## System Layers

1. **Core is UI-agnostic**: `@pokit/core` has zero TTY dependencies.
2. **Adapters are explicit**: prompters, reporters, tabs, and apps are configured separately.
3. **Output is event-driven**: commands emit semantic events instead of writing directly to the terminal.
4. **Context is typed**: Zod schemas drive TypeScript inference through commands, tasks, and env resolvers.
5. **Commands are file-backed**: the router builds the command tree from files and mounted sources.

## Runtime graph

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Entry Point                          │
│                    run(args, config)                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Router                                 │
│  • Discovers commands from filesystem                            │
│  • Builds command tree                                           │
│  • Parses args → routes to command                              │
│  • Shows interactive menu when no args                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Command                                 │
│  • Defines context (flags) with Zod schemas                     │
│  • Pre-flight checks                                            │
│  • Run function receives Runner + Context                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Runner                                 │
│  • exec(cmd) - Execute shell commands                           │
│  • run(task) - Execute tasks with env resolution                │
│  • parallel([...]) - Race execution                             │
│  • tabs([...]) - Tabbed terminal UI                             │
│  • group() - Visual grouping                                    │
│  • reporter - Event emission                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│        Event Bus         │    │     Env Resolvers        │
│  Decoupled pub/sub for   │    │  Fetch secrets based on  │
│  CLI events              │    │  command context         │
└──────────────────────────┘    └──────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Reporter Adapter                             │
│  Subscribes to events → renders terminal UI                      │
│  (e.g., @pokit/reporter-clack)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Package Architecture

```
@pokit/core                 # Zero TTY dependencies
├── Command definitions
├── Task definitions
├── Environment/Resolver system
├── Pre-flight checks
├── Router (file-based)
├── Runner (execution engine)
├── Event system (bus + types)
├── Prompter interface (abstract)
├── Reporter interface (abstract)
└── Tabs interface (abstract)

@pokit/prompter-clack       # Interactive input
└── Clack-based Prompter implementation

@pokit/reporter-clack       # Terminal output
└── Clack-based Reporter adapter

@pokit/opentui             # Tabbed UI
├── OpenTUI (React) based tabs adapter
└── Full-screen alternate buffer

@pokit/tabs-core            # Shared tabs logic
├── State management
├── Process manager
└── Framework-agnostic types

create-pokit                # Scaffolding
└── bun create pokit
```

## Event-Driven Output

pok uses an event-driven output model. Commands do not write terminal UI directly. They emit semantic events that reporter adapters render.

### Event Types

```typescript
type CLIEvent =
  // Lifecycle
  | { type: 'root:start'; appName: string }
  | { type: 'root:end'; exitCode: number }

  // Grouping
  | { type: 'group:start'; id: string; label: string; layout: GroupLayout }
  | { type: 'group:end'; id: string }

  // Activities
  | { type: 'activity:start'; id: string; label: string }
  | { type: 'activity:success'; id: string }
  | { type: 'activity:failure'; id: string; error: Error }
  | { type: 'activity:update'; id: string; payload: UpdatePayload }

  // Logging
  | { type: 'log'; level: LogLevel; message: string }

  // TUI Control
  | { type: 'reporter:suspend' }
  | { type: 'reporter:resume' };
```

### Why the event bus exists

1. Tests can assert on events instead of terminal snapshots.
2. Different adapters can render the same command flow for local TTYs, CI, or custom UIs.
3. Command code stays focused on execution while adapters own presentation.
4. Multiple consumers can observe the same event stream.

## File-Based Routing

Commands are discovered from `.ts` files in the commands directory. Filenames determine the command path:

```
commands/
├── dev.ts                 → mycli dev
├── build.ts               → mycli build
├── deploy.ts              → mycli deploy
├── db.ts                  → mycli db (parent)
├── db.migrate.ts          → mycli db migrate
├── db.seed.ts             → mycli db seed
└── db.migrate.up.ts       → mycli db migrate up
```

### Parent Commands

Files without a `run` function become parent commands that show a submenu:

```typescript
// commands/db.ts - Parent command
export const command = defineCommand({
  label: 'Database operations',
  enableRunAllChildren: 'sequential', // Optional: adds "all" option
});
```

## Type Flow

pok uses TypeScript's type inference extensively:

```
Context Definition (Zod)
        │
        ▼
    InferContext<C>
        │
        ├─────────────────┐
        ▼                 ▼
   RunContext<C>     Runner<C>
        │                 │
        │                 ▼
        │         Task execution
        │         (context flows to
        │          env resolvers)
        ▼
   ctx.context.env  // Typed!
```

This ensures:

- Flags are typed based on their Zod schema
- Tasks can only run if the command's context satisfies requirements
- Environment variables are typed based on resolver declarations

## Process Management

pok handles process lifecycle automatically:

- **Signal handling** - SIGINT/SIGTERM cleanup
- **Process tracking** - All spawned processes are tracked
- **Parallel execution** - Race semantics with automatic cleanup
- **Abort support** - Commands can be cancelled via AbortSignal

## Next steps

- [Commands](./concepts/commands.md) - Command definitions and patterns
- [Tasks](./concepts/tasks.md) - Reusable units of work
- [Events](./concepts/events.md) - Event system details
