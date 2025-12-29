# Redesign: `pok learn` Command

## Problem

The current `pok learn` is a tutorial that explains things. It says "here's how to define a command" then asks "would you like me to create this for you?"

This is backwards. **Do, then understand** - not explain, then do.

## Scope

- `playground/src/hooks/useWebContainer.ts` - embedded learn command
- `playground/src/App.tsx` - layout for split panels
- New: `pok introspect` command (separate design, referenced here)

## Design Principle

**The learn command is an agent that works while you watch.**

It doesn't ask permission. It doesn't explain concepts. It acts. The introspect panel (running in a second terminal) shows the files as they appear.

The user's job is to observe, not to operate.

---

## Command Specification

### Entry Point

```
$ pok learn
```

### Menu

```
What do you want to see?

  > Create a command
    Add arguments
    See tabs
    Explore freely
```

Four options. No checkmarks. No progress. Each option triggers an **action sequence**.

---

## Action Sequences

### Option 1: "Create a command"

**What happens:**

```
Creating commands/hello.ts...

┌─ commands/hello.ts ────────────────────┐
│                                        │
│  defineCommand({                       │
│    label: 'Say hello',                 │
│    run: async (r) => {                 │
│      r.reporter.success('Hello!');     │
│    },                                  │
│  });                                   │
│                                        │
└────────────────────────────────────────┘

Running: pok hello

◇ Hello!

Done. You just saw a command created and executed.
```

**Timing:**
- File creation: instant
- Brief pause (300ms) before running
- Command execution: instant

**In introspect panel:** User sees `commands/hello.ts` appear in real-time.


### Option 2: "Add arguments"

**What happens:**

```
Creating commands/greet.ts...

┌─ commands/greet.ts ────────────────────┐
│                                        │
│  defineCommand({                       │
│    label: 'Greet someone',             │
│    context: {                          │
│      name: {                           │
│        from: 'flag',                   │
│        schema: z.string(),             │
│      },                                │
│    },                                  │
│    run: async (r, { context }) => {    │
│      r.reporter.success(               │
│        `Hello, ${context.name}!`       │
│      );                                │
│    },                                  │
│  });                                   │
│                                        │
└────────────────────────────────────────┘

Running: pok greet --name World

◇ Hello, World!

Done. Flags become context. Schema validates them.
```

**In introspect panel:** User sees `commands/greet.ts` with the `context` object.


### Option 3: "See tabs"

**What happens:**

```
Tabs run multiple processes side by side.

┌─ commands/dev.ts ──────────────────────┐
│                                        │
│  defineCommand({                       │
│    label: 'Development servers',       │
│    run: async (r) => {                 │
│      await r.tabs([                    │
│        r.exec('npm run server'),       │
│        r.exec('npm run watch'),        │
│      ]);                               │
│    },                                  │
│  });                                   │
│                                        │
└────────────────────────────────────────┘

In a real terminal, this opens a tabbed interface.
Each tab shows its process output.
Switch with ← →, quit with q.

(Can't demo in browser - tabs need a real terminal.)
```

**Why no execution:** Tabs require a TUI which WebContainer can't provide. We show the code and explain the limitation honestly.


### Option 4: "Explore freely"

**What happens:**

```
Your commands are in ./commands

Try:
  pok         - see all commands
  pok hello   - run hello command
  pok --help  - see options

$
```

**Behavior:** Exits to shell prompt. User has full control.

---

## Output Format

### Code Display

Use a simple box drawing format:

```
┌─ {filename} ─────────────────────────┐
│                                      │
│  {code line 1}                       │
│  {code line 2}                       │
│                                      │
└──────────────────────────────────────┘
```

No syntax highlighting. The simplicity is the point.

### Status Messages

- **Action:** `Creating {file}...` (no emoji)
- **Execution:** `Running: {command}` (shows exact command)
- **Completion:** `Done. {one-line insight}` (no celebration)

### Reporter Output

Command output uses the standard reporter:
- `◇` prefix for success (from clack)
- Standard colors

---

## Technical Approach

### File Operations

Use Node.js `fs` (available in WebContainer):

```typescript
const { writeFileSync } = require('fs');

writeFileSync('commands/hello.ts', code);
```

Files appear instantly in the filesystem. The introspect panel (separate command) watches for changes.

### Command Execution

Use Bun.spawn or child_process to run pok commands:

```typescript
const { execSync } = require('child_process');

// Capture and display output
const output = execSync('pok hello', { encoding: 'utf-8' });
r.reporter.info(output);
```

Alternatively, use `r.exec()` but we need output capture:

```typescript
// This streams to terminal directly
await r.exec('pok hello');
```

**Decision:** Use `execSync` with captured output so we control formatting.

### Menu Loop

The command runs a menu loop but returns to menu only if user requests:

```typescript
run: async (r) => {
  while (true) {
    const choice = await r.prompter.select({
      message: 'What do you want to see?',
      options: [
        { value: 'create', label: 'Create a command' },
        { value: 'args', label: 'Add arguments' },
        { value: 'tabs', label: 'See tabs' },
        { value: 'exit', label: 'Explore freely' },
      ],
    });

    if (choice === 'exit') break;
    
    await runAction(choice, r);
    
    // Small pause before returning to menu
    await sleep(500);
  }
}
```

### Output Streaming

For real-time feel, print output progressively:

```typescript
async function printBox(filename: string, code: string, r: Runner) {
  r.reporter.info(`Creating ${filename}...`);
  await sleep(200);
  
  r.reporter.info('');
  r.reporter.info(`┌─ ${filename} ${'─'.repeat(40 - filename.length)}┐`);
  
  for (const line of code.split('\n')) {
    r.reporter.info(`│  ${line.padEnd(38)}│`);
    await sleep(30); // Typewriter effect
  }
  
  r.reporter.info(`└${'─'.repeat(42)}┘`);
  r.reporter.info('');
}
```

---

## The Actual Code

```typescript
const { defineCommand } = require('@openpok/core');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { execSync } = require('child_process');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const HELLO_CODE = `const { defineCommand } = require('@openpok/core');

exports.command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    r.reporter.success('Hello!');
  },
});
`;

const GREET_CODE = `const { z } = require('zod');
const { defineCommand } = require('@openpok/core');

exports.command = defineCommand({
  label: 'Greet someone',
  context: {
    name: {
      from: 'flag',
      schema: z.string(),
    },
  },
  run: async (r, { context }) => {
    r.reporter.success(\`Hello, \${context.name}!\`);
  },
});
`;

const DEV_CODE = `const { defineCommand } = require('@openpok/core');

exports.command = defineCommand({
  label: 'Development servers',
  run: async (r) => {
    await r.tabs([
      r.exec('npm run server'),
      r.exec('npm run watch'),
    ]);
  },
});
`;

function printBox(r: any, filename: string, code: string) {
  const lines = code.trim().split('\n');
  const width = 50;
  const padding = width - filename.length - 4;
  
  r.reporter.info(`┌─ ${filename} ${'─'.repeat(padding)}┐`);
  r.reporter.info('│' + ' '.repeat(width) + '│');
  for (const line of lines) {
    const padded = '  ' + line.padEnd(width - 2);
    r.reporter.info('│' + padded.slice(0, width) + '│');
  }
  r.reporter.info('│' + ' '.repeat(width) + '│');
  r.reporter.info('└' + '─'.repeat(width + 2) + '┘');
}

exports.command = defineCommand({
  label: 'Learn pok interactively',
  run: async (r) => {
    // Ensure commands directory exists
    if (!existsSync('commands')) {
      mkdirSync('commands');
    }

    while (true) {
      const choice = await r.prompter.select({
        message: 'What do you want to see?',
        options: [
          { value: 'create', label: 'Create a command' },
          { value: 'args', label: 'Add arguments' },
          { value: 'tabs', label: 'See tabs' },
          { value: 'exit', label: 'Explore freely' },
        ],
      });

      if (choice === 'exit') {
        r.reporter.info('');
        r.reporter.info('Your commands are in ./commands');
        r.reporter.info('');
        r.reporter.info('Try:');
        r.reporter.info('  pok         - see all commands');
        r.reporter.info('  pok hello   - run hello command');
        r.reporter.info('  pok --help  - see options');
        r.reporter.info('');
        break;
      }

      r.reporter.info('');

      if (choice === 'create') {
        r.reporter.info('Creating commands/hello.ts...');
        r.reporter.info('');
        
        writeFileSync('commands/hello.ts', HELLO_CODE);
        
        printBox(r, 'commands/hello.ts', HELLO_CODE);
        
        r.reporter.info('');
        r.reporter.info('Running: pok hello');
        r.reporter.info('');
        
        await sleep(300);
        
        try {
          execSync('node_modules/.bin/pok hello', { 
            stdio: 'inherit',
            cwd: process.cwd()
          });
        } catch (e) {
          // Command output already shown
        }
        
        r.reporter.info('');
        r.reporter.info('Done. You just saw a command created and executed.');
      }

      if (choice === 'args') {
        r.reporter.info('Creating commands/greet.ts...');
        r.reporter.info('');
        
        writeFileSync('commands/greet.ts', GREET_CODE);
        
        printBox(r, 'commands/greet.ts', GREET_CODE);
        
        r.reporter.info('');
        r.reporter.info('Running: pok greet --name World');
        r.reporter.info('');
        
        await sleep(300);
        
        try {
          execSync('node_modules/.bin/pok greet --name World', { 
            stdio: 'inherit',
            cwd: process.cwd()
          });
        } catch (e) {
          // Command output already shown
        }
        
        r.reporter.info('');
        r.reporter.info('Done. Flags become context. Schema validates them.');
      }

      if (choice === 'tabs') {
        r.reporter.info('Tabs run multiple processes side by side.');
        r.reporter.info('');
        
        printBox(r, 'commands/dev.ts', DEV_CODE);
        
        r.reporter.info('');
        r.reporter.info('In a real terminal, this opens a tabbed interface.');
        r.reporter.info('Each tab shows its process output.');
        r.reporter.info('Switch with ← →, quit with q.');
        r.reporter.info('');
        r.reporter.warn('(Can\\'t demo in browser - tabs need a real terminal.)');
      }

      r.reporter.info('');
      await sleep(500);
    }
  },
});
```

---

## Integration with Introspect

The `pok introspect` command (designed separately) runs in a second terminal and:

1. Watches `./commands/` directory for changes
2. When a file appears/changes, displays its contents
3. Auto-updates when learn creates files

**The split-screen setup:**

```
┌─────────────────────────┬─────────────────────────┐
│ $ pok learn             │ $ pok introspect        │
│                         │                         │
│ What do you want to see?│ Watching ./commands/    │
│ > Create a command      │                         │
│   Add arguments         │ (waiting for files...)  │
│   See tabs              │                         │
│   Explore freely        │                         │
│                         │                         │
├─────────────────────────┼─────────────────────────┤
│ (after user selects)    │ (file appears)          │
│                         │                         │
│ Creating hello.ts...    │ ─── hello.ts ─────────  │
│                         │                         │
│ Running: pok hello      │ defineCommand({         │
│                         │   label: 'Say hello',   │
│ ◇ Hello!                │   run: async (r) => {   │
│                         │     r.reporter.success( │
│ Done.                   │       'Hello!');        │
│                         │   },                    │
│                         │ });                     │
└─────────────────────────┴─────────────────────────┘
```

The left panel shows **action**. The right panel shows **result**.

Cause and effect. No explanation needed.

---

## What This Removes

From the current learn command:
- ❌ Welcome text ("Welcome to pok! This interactive tutorial...")
- ❌ Progress tracking ("Progress: 2/4 lessons completed")
- ❌ Completion checkmarks ("✓ Your first command")
- ❌ Concept explanations ("Commands in pok are TypeScript files...")
- ❌ Permission prompts ("Would you like me to create this?")
- ❌ Exit-and-return flow ("Exit tutorial to try it now?")
- ❌ The "How was this made?" lesson (meta-explanation)
- ❌ Emoji celebrations ("🎉 You just created your first command!")

## What This Keeps

- ✅ Interactive menu
- ✅ File creation
- ✅ Command execution
- ✅ Brief closing statements
- ✅ Free exploration exit

---

## Results

Implementation completed on 2024-12-29.

### Changes Made

1. **Replaced learn.ts content** in `playground/src/hooks/useWebContainer.ts`
   - Removed ~380 lines of tutorial-style explanation code
   - Replaced with ~165 lines of action-based demonstration code

2. **New behavior:**
   - Four menu options: Create a command, Add arguments, See tabs, Explore freely
   - "Create a command" - instantly creates `commands/hello.ts`, shows code in box, runs `pok hello`
   - "Add arguments" - creates `commands/greet.ts` with `--name` flag, runs `pok greet --name World`  
   - "See tabs" - shows code example, explains limitation in browser
   - "Explore freely" - exits with helpful hints

3. **Removed:**
   - Welcome text and progress tracking
   - Permission prompts ("Would you like me to create this?")
   - Concept explanations before showing code
   - Exit-and-return flow
   - "How was this made?" lesson
   - Emoji celebrations

4. **Verification:**
   - TypeScript check passes (`tsc --noEmit` in playground)
   - Playground dev server starts successfully

## Evaluation

The implementation follows the design document closely. Key improvements:

- **Do, then understand**: Commands are created and run immediately without asking permission
- **Minimal ceremony**: No progress bars, no checkmarks, no celebrations
- **Action-oriented**: Each menu option triggers visible file system changes and command execution
- **Concise closing**: Brief insight after each action ("Flags become context. Schema validates them.")

The learn command is now an agent that demonstrates pok capabilities through action rather than explanation.
