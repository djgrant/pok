# Router

The router is the entry point for pok CLIs. It discovers commands from the filesystem, builds a command tree, and handles navigation and execution.

## Import

```typescript
import { run, runCli, buildCommandTree } from '@pokit/core';
```

## runCli

The recommended entry point for production CLIs. It handles the full lifecycle including:
- Command line argument parsing
- Output configuration detection (TTY, flags)
- Version handling (`--version`)
- Error reporting with clean messages
- Process exit codes

### Signature

```typescript
function runCli(args: string[], config: RunCliConfig): Promise<void>;
```

### RunCliConfig

| Property          | Type                            | Description                                        |
| ----------------- | ------------------------------- | -------------------------------------------------- |
| `commandsDir`     | `string`                        | Absolute path to command files                     |
| `projectRoot`     | `string`                        | Absolute path to project root                      |
| `appName`         | `string`                        | App name for display and history                   |
| `version`         | `string`                        | Version string for --version flag                  |
| `reporterAdapter` | `ReporterAdapter`               | Adapter for rendering output                       |
| `prompter`        | `Prompter`                      | Adapter for interactive input                      |
| `tabs`            | `TabsAdapter`                   | Optional adapter for tabbed UI                     |
| `pmScripts`       | `boolean \| string[]`           | Include package manager scripts (e.g., npm scripts) |
| `pmCommands`      | `boolean \| string[]`           | Include package manager commands                   |
| `extraCommands`   | `Record<string, CommandConfig>` | Manual command overrides                           |
| `plugins`         | `MountableLike[]`               | Dynamic command sources to mount at root           |

## MountableLike

A `MountableLike` is any object that can be resolved into a command tree. The following helper functions return mountables:

- **`fromDirectory(baseUrl: string, relativePath: string)`**: Mounts all `.ts` and `.tsx` files from a directory.
- **`fromConfig(baseUrl: string, relativePath: string)`**: Mounts an entire pok application from its `pok.config.ts` file or directory.
- **`fromObject(tree: CommandTree)`**: Mounts a pre-built command tree.

## Plugins

Plugins allow you to extend your CLI with commands from other packages or local directories. You can provide them in the `plugins` array of `RunCliConfig`:

```typescript
import { fromDirectory } from '@pokit/core';

await runCli(process.argv.slice(2), {
  // ...
  plugins: [
    // Mount internal tools at the root level
    fromDirectory(import.meta.url, './tools'),
  ],
});
```

### Example (Standalone CLI)

```typescript
#!/usr/bin/env bun
import { runCli } from '@pokit/core';
import { createPrompter } from '@pokit/prompter-clack';
import { createReporterAdapter } from '@pokit/reporter-clack';
import * as path from 'path';

await runCli(process.argv.slice(2), {
  commandsDir: path.resolve(import.meta.dir, 'commands'),
  projectRoot: path.resolve(import.meta.dir),
  appName: 'my-cli',
  version: '1.0.0',
  prompter: createPrompter(),
  reporterAdapter: createReporterAdapter(),
});
```

## run

Lower-level entry point used internally by `runCli`. Use this if you need custom control over the execution lifecycle or want to bypass the standard CLI behavior.

### Signature

```typescript
function run(args: string[], config: RouterConfig): Promise<void>;
```

### RouterConfig

```typescript
type RouterConfig = {
  commandsDir: string;
  projectRoot: string;
  appName?: string;
  version?: string;
  reporterAdapter: ReporterAdapter;
  prompter: Prompter;
  tabs?: TabsAdapter;
  noTty?: boolean; // Disable interactivity
  // ... other internal flags
};
```


## File-Based Routing

Commands are discovered from `.ts` and `.tsx` files in the commands directory.

### Naming Convention

Filenames use dot-notation for hierarchy:

```
commands/
├── dev.ts                    → mycli dev
├── build.ts                  → mycli build
├── deploy.ts                 → mycli deploy
├── db.ts                     → mycli db (parent)
├── db.migrate.ts             → mycli db migrate
├── db.seed.ts                → mycli db seed
├── db.migrate.up.ts          → mycli db migrate up
└── generate.types.ts         → mycli generate types
```

### File Structure

Each command file exports a `command` object:

```typescript
// commands/build.ts
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Build the project',
  run: async (r) => {
    await r.exec('npm run build');
  },
});
```

### Skipped Files

Files starting with `_` are ignored:

```
commands/
├── _shared.ts      → Not a command (utility file)
├── _checks.ts      → Not a command
└── build.ts        → mycli build
```

## Command Tree

Commands form a tree structure:

```typescript
type CommandNode = {
  path: string; // e.g., 'db.migrate'
  segment: string; // e.g., 'migrate'
  config: CommandConfig;
  children: Map<string, CommandNode>;
};

type CommandTree = Map<string, CommandNode>;
```

### buildCommandTree

Build the command tree from a directory:

```typescript
const tree = await buildCommandTree('/path/to/commands');
```

## Routing Behavior

### No Arguments → Interactive Menu

When you run your CLI without any arguments, pok opens an interactive menu showing all top-level commands.

```bash
$ mycli
◆  mycli
│  ○ What would you like to do?
│  ● build - Build the project
│  ○ deploy - Deploy to environment
│  ○ db - Database operations
```

**Search-ahead**: Interactive menus support autocomplete search-ahead. You can start typing to filter the available commands and press `Enter` to select.

### With Arguments → Direct Execution

```bash
$ mycli build
# Executes commands/build.ts
```

### Partial Path → Submenu

```bash
$ mycli db
◆  Database operations
│  ○ Select db:
│  ● migrate - Run migrations
│  ○ seed - Seed database
```

### Full Path

```bash
$ mycli db migrate
# Executes commands/db.migrate.ts
```

## Parent Commands

Commands without a `run` function are parent commands:

```typescript
// commands/db.ts
export const command = defineCommand({
  label: 'Database operations',
  // No run function - this is a parent
});
```

### Run All Children

Parent commands can enable running all children:

```typescript
// commands/check.ts
export const command = defineCommand({
  label: 'Run all checks',
  enableRunAllChildren: 'sequential', // or 'parallel'
});
```

This adds an "all" option to the submenu:

```bash
$ mycli check
◆  Run all checks
│  ○ Select check:
│  ● all - Run all commands
│  ○ types - Type check
│  ○ lint - Lint code
│  ○ format - Check formatting
```

Or run directly:

```bash
$ mycli check all
```

### quietRunAll

Control output capture when running all children:

```typescript
export const command = defineCommand({
  label: 'Run all checks',
  enableRunAllChildren: 'sequential',
  quietRunAll: true, // Default: capture output, show on failure
  // quietRunAll: false,  // Stream output to terminal
});
```

## Context Resolution

### From Flags

```bash
$ mycli deploy --env staging
```

### Interactive Prompts

Missing required flags trigger prompts:

```bash
$ mycli deploy
? Select environment › staging / prod
```

### Extra Arguments

Arguments not consumed by the path or flags are passed as `extraArgs`:

```bash
$ mycli build --mode prod -- --verbose
# extraArgs: ['--verbose']
```

## Error Handling

### Unknown Command

```bash
$ mycli unknown
Error: Unknown command: unknown
Run without arguments for interactive menu
```

### No Implementation

```bash
$ mycli orphan
Error: Command "orphan" has no implementation or children
```

## Process Flow

```
1. Parse args
2. Build command tree
3. Route to node
   ├── No args? → Interactive menu
   ├── Found runnable? → Execute
   └── Found parent? → Show submenu
4. Resolve context (flags + prompts)
5. Run pre-checks
6. Execute command
7. Cleanup
```
