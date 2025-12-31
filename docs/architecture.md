# Architecture

pok is built on a modular, event-driven architecture that separates concerns into distinct layers.

## Design Principles

1. **Core is UI-agnostic** - The `@pokit/core` package has zero TTY dependencies
2. **Plugin-based adapters** - Consumers choose which terminal features they need
3. **Event-driven architecture** - Commands emit events; adapters decide how to render
4. **Type-safe** - Full TypeScript with inferred types throughout
5. **File-based routing** - Commands discovered from filesystem, no registration needed

## System Overview

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

@pokit/tabs-ink             # Tabbed UI
├── Ink (React) based tabs adapter
└── Full-screen alternate buffer

@pokit/tabs-core            # Shared tabs logic
├── State management
├── Process manager
└── Framework-agnostic types

create-pokit                # Scaffolding
└── bun create pokit
```

## Event-Driven Output

pok uses an event-driven architecture for all output. Commands don't write to stdout directly—they emit semantic events that adapters render.

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

### Benefits

1. **Testability** - Mock the adapter, assert on events
2. **Flexibility** - Different UIs for different contexts (CI vs local)
3. **Separation** - Commands focus on logic, adapters focus on presentation
4. **Composability** - Multiple adapters can consume the same events

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

## Next Steps

- [Commands](./concepts/commands.md) - Deep dive into command definitions
- [Tasks](./concepts/tasks.md) - Reusable units of work
- [Events](./concepts/events.md) - Event system details
