# Architecture

pok is a command router, execution runner, event bus, and adapter layer for TypeScript CLIs. The core package builds command trees, validates context, runs commands and tasks, resolves environments, and emits semantic events that adapters render.

## System Layers

1. **Core is UI-agnostic**: `@pokit/core` has zero TTY dependencies.
2. **UI is a single bundle**: `@pokit/terminal` provides the reporter, prompter, and navigator behind one factory (`createTerminalUI`). It is optional and, when omitted from config, wired in by the launcher.
3. **Output is event-driven**: commands emit semantic events instead of writing directly to the terminal.
4. **Menus have a policy**: the `Navigator` owns menu presentation (breadcrumbs, choose/back/exit), separate from the router that owns tree structure.
5. **Context is typed**: Zod schemas drive TypeScript inference through commands, tasks, and env resolvers.
6. **Commands are file-backed**: the router builds the command tree from files and mounted sources.

## The launcher (`pok` / `pokit`)

The global `pok` binary is a **trampoline**. When a project ships its own local
`pokit` install, the launcher re-executes that local launcher with the same
argv (guarded by the `POK_DELEGATED` env flag; set `POK_DEBUG` to trace the
decision) so the project runs entirely on the version it pinned. Otherwise it
loads `pok.config.ts` — or, in a plain `package.json` repo with no config, runs
in **fallback mode**, surfacing the `commands/` directory and package scripts.
Either way it fills in any omitted reporter/prompter/navigator from
`@pokit/terminal`.

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
│  • Shows interactive menu (via Navigator) when no args          │
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
│  • parallel([...]) - Concurrent execution (race/fail-fast/all)  │
│  • group() - Visual grouping                                    │
│  • reporter - Event emission                                    │
│  • prompter - Interactive input                                 │
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
│  (from @pokit/terminal)                                          │
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
├── Navigator interface + default menu navigator
└── Config (defineConfig, validation)

@pokit/terminal             # Default terminal UI (clack)
└── createTerminalUI() → { reporter, prompter, navigator }

pokit                       # Global launcher / trampoline
├── Config discovery + delegation to local pokit
├── Fallback mode (package.json, no config)
└── pok init

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
  | { type: 'activity:start'; id: string; parentId?: string; label: string; meta?: Record<string, unknown> }
  | { type: 'activity:success'; id: string; result?: unknown }
  | { type: 'activity:failure'; id: string; error: Error | string; remediation?: string[]; documentationUrl?: string }
  | { type: 'activity:update'; id: string; payload: ActivityUpdatePayload }

  // Logging
  | { type: 'log'; activityId?: string; level: LogLevel; message: string };

// GroupLayout is 'sequence' | 'parallel'
// LogLevel is 'info' | 'warn' | 'error' | 'success' | 'step'
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

### Menu Navigation

When the router reaches a parent node with no matching argument, it asks the
`Navigator` to present the node's children. The navigator emits a breadcrumb
(`app > db`), then prompts (autocomplete when available, otherwise select). A
selection descends or executes; a cancelled prompt (**Esc** / **Ctrl-C**) is
mapped to `back`, popping up one level. At the **root**, `back` means **exit**,
so Esc/Ctrl-C at the top-level menu quits the CLI.

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

- [Commands](./commands.md) - Command definitions and patterns
- [Tasks](./tasks.md) - Reusable units of work
- [Events](./events.md) - Event system details
