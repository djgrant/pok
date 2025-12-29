# Interactive Website Specification

## Overview

The pok interactive website is a browser-based tutorial that teaches users how to use pok. The key insight is: **pok teaches pok using pok**.

The entire tutorial is a single pok command (`pok learn`) running in a WebContainer. Users interact with pok directly—not through a separate UI layer.

## Design Philosophy

1. **Terminal is king** - One full-screen terminal. No sidebars, no panels, no split views.
2. **Show, don't tell** - Users learn by running commands, not reading docs.
3. **Self-documenting** - The tutorial is itself a pok command. Users can view its source.
4. **Zero friction** - No setup. Land on page, start learning immediately.

## Architecture

```
┌─────────────────────────────────────────┐
│ pok                          [↻ Reset]  │  ← Minimal header
├─────────────────────────────────────────┤
│                                         │
│  $ pok learn                            │
│                                         │
│  Welcome to pok!                        │
│                                         │
│  What would you like to learn?          │
│  ● Your first command                   │
│  ○ Arguments and flags                  │
│  ○ Tabs (multi-process)                 │
│  ○ How was this made?                   │
│  ○ Free exploration                     │
│                                         │
└─────────────────────────────────────────┘
```

### Components

1. **Header** (40px)
   - Left: "pok" wordmark in accent blue (#7aa2f7)
   - Right: Reset button (reloads page)

2. **Terminal** (fills remaining viewport)
   - xterm.js terminal
   - Connected to WebContainer shell
   - Auto-runs `pok learn` on boot

3. **Loading State**
   - Simple spinner
   - Status text: "Starting pok..." or "Installing..."

4. **Error State**
   - Error icon and message
   - Retry button

## Boot Sequence

1. Page loads
2. WebContainer initializes
3. Project files are mounted (package.json, pok.config.ts, commands/learn.ts)
4. Dependencies are pre-bundled (no npm install needed)
5. Shell starts
6. `pok learn` runs automatically
7. User sees interactive menu

**Expected boot time:** < 10 seconds on good connection

## The `pok learn` Command

Located at: `commands/learn.ts` (embedded in WebContainer filesystem)

### Menu Structure

```
What would you like to learn?
├── Your first command
├── Arguments and flags  
├── Tabs (multi-process)
├── How was this made?
└── Free exploration
```

### Lesson: Your First Command

**Goal:** Create and run a simple pok command

**Flow:**
1. Explain that commands are TypeScript files in `commands/`
2. Show the structure: `defineCommand({ label, run })`
3. Offer to create `commands/hello.ts`
4. If yes, write the file using `fs.writeFileSync`
5. Prompt user to exit and run `pok hello`
6. Celebrate success

**Expected output:**
```
=== Your First Command ===

Commands in pok are TypeScript files in the commands/ directory.
Each command exports using defineCommand().

Here's a simple command:

  import { defineCommand } from '@openpok/core';

  export const command = defineCommand({
    label: 'Say hello',
    run: async (r) => {
      r.reporter.info('Hello, pok!');
    },
  });

? Create this command? (commands/hello.ts)
● Yes, create it
○ No, skip

✓ Created commands/hello.ts

Now exit to the shell and run: pok hello

? Ready to continue?
```

### Lesson: Arguments and Flags

**Goal:** Add arguments to a command

**Flow:**
1. Build on lesson 1
2. Explain the `args` property
3. Show a `greet` command with `--name` and `--shout` args
4. Offer to create `commands/greet.ts`
5. Show usage: `pok greet --name=Alice --shout`

### Lesson: Tabs (multi-process)

**Goal:** Explain pok's tabs feature

**Flow:**
1. Explain what tabs are (multiple processes, switch between them)
2. Show use cases (dev server + watcher, tests + linter)
3. Show the API: `r.tabs([r.exec('...'), r.exec('...')])`
4. Note: Cannot demo in browser (TUI requires real terminal)
5. Point to local setup for trying it

### Lesson: How was this made?

**Goal:** Show the tutorial's own source code

**Flow:**
1. Explain this tutorial IS a pok command
2. List what it uses: defineCommand, prompter, reporter, fs
3. Read and display `commands/learn.ts` source
4. Link to pok repo for more

### Free Exploration

**Goal:** Let users experiment

**Flow:**
1. Print helpful message
2. Exit to shell prompt
3. User can run `pok --help`, create commands, etc.

## Technical Details

### WebContainer Filesystem

```
/
├── package.json
├── pok.config.ts
├── commands/
│   └── learn.ts
└── node_modules/  (pre-bundled)
    ├── @openpok/core
    ├── @openpok/prompter-clack
    └── @openpok/reporter-clack
```

### Pre-bundled Packages

To avoid slow npm install, packages are bundled at build time using a Vite plugin. The WebContainer mounts them directly.

### Terminal Configuration

- Font: Menlo, Monaco, Consolas (monospace)
- Font size: 14px
- Theme: Tokyo Night colors
- Cursor: Blinking block

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| bg-primary | #1a1b26 | Terminal background |
| bg-secondary | #24283b | Header background |
| text-primary | #c0caf5 | Main text |
| text-muted | #565f89 | Secondary text |
| accent | #7aa2f7 | Branding, links |
| success | #9ece6a | Success states |
| error | #f7768e | Error states |

## User Flows

### Happy Path

1. User visits site
2. Sees loading spinner (< 5s)
3. Terminal appears with `pok learn` running
4. User selects "Your first command"
5. Follows prompts, creates hello.ts
6. Exits to shell, runs `pok hello`
7. Returns to menu or explores freely

### Error: WebContainer fails to boot

1. User visits site
2. Loading spinner
3. Error screen appears
4. Shows error message and "Retry" button
5. User clicks Retry (page reload)

### Error: Unsupported browser

1. User visits site (Safari, old browser)
2. "Browser Not Supported" screen
3. Links to download Chrome/Firefox

### User wants to start over

1. User clicks Reset button in header
2. Page reloads
3. WebContainer reboots
4. `pok learn` runs fresh

## Browser Support

- Chrome 90+ (recommended)
- Firefox 90+
- Edge 90+
- Safari: Not supported (WebContainer limitation)

## Performance Targets

| Metric | Target |
|--------|--------|
| Time to interactive | < 10s |
| Terminal responsiveness | < 50ms input lag |
| Memory usage | < 500MB |

## Files

```
playground/
├── src/
│   ├── App.tsx              # Main app, renders header + terminal
│   ├── index.css            # Minimal styles (~200 lines)
│   ├── main.tsx             # Entry point
│   ├── components/
│   │   ├── Terminal.tsx     # xterm.js wrapper, auto-runs pok learn
│   │   ├── LoadingScreen.tsx
│   │   └── UnsupportedBrowser.tsx
│   └── hooks/
│       ├── useWebContainer.ts  # WebContainer init, mounts files
│       └── useBrowserSupport.ts
├── index.html
├── vite.config.ts           # Includes pok-bundle plugin
└── SPEC.md                  # This file
```

## What We Removed

The previous implementation had:
- Sidebar with lesson navigation
- Lesson content panel with markdown rendering
- "Run" buttons on code blocks
- "Mark Complete" checkboxes
- Progress tracking in localStorage
- 700+ lines of CSS

All removed. Terminal is the only UI now.

## Future Considerations

1. **Tabs demo in browser** - If xterm.js adds TUI support, enable live tabs demo
2. **More lessons** - Tasks, checks, environments, composition
3. **Shareable state** - URL params to jump to specific lessons
4. **Analytics** - Track which lessons users complete (privacy-respecting)
