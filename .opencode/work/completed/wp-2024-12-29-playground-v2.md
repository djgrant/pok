# Playground v2: Two-Terminal Design

## Vision

Two terminals side by side:
- **Left**: `pok learn` - interactive guide that *does things*
- **Right**: `pok introspect` - live file viewer with syntax highlighting

When learn creates a file, it appears in introspect. User sees cause and effect directly. No explaining - just doing.

## Design Principles Applied

- **Principle 4**: Ceremony-free interfaces. Learn bridges intent ("understand pok") to execution (creates files, runs commands).
- **Principle 2**: Convention over configuration. Files appear where expected.
- **Principle 3**: Show, don't tell. The introspect panel IS the explanation.

## Core Components

### 1. `pok introspect` command
A TUI command (view-only) that:
- Shows file tree of commands/
- Syntax highlighted file preview
- Live reloads on filesystem changes
- Arrow key navigation between files

### 2. `pok learn` command (redesigned)
An interactive guide that *executes*, not explains:
- User selects an option
- Learn performs actions (scaffolds files, runs commands)
- User watches it happen in real-time
- Minimal text - actions speak

### 3. Two-terminal playground layout
- Side by side terminals
- Left: `pok learn` (action)
- Right: `pok introspect` (evidence)

### 4. Whimsical loading
- Fun, not corporate
- Bouncing ball or similar
- Silly loading words

## User Flow

1. Page loads → whimsical loading
2. Two terminals appear
3. Left: `pok learn` with menu
4. Right: `pok introspect` showing current files
5. User selects "Create a command"
6. Left: Shows actions being performed
7. Right: File appears, syntax highlighted
8. Left: Runs the command, shows output
9. User sees the whole loop

## Learn Command Options

1. **Create a command** - Scaffolds hello.ts, runs it
2. **Add arguments** - Creates greet.ts with flags, demos usage
3. **See tabs in action** - Shows multi-process capability
4. **Explore freely** - Exits to shell

Each option is a sequence of actions, not a lesson.

## Technical Requirements

### pok introspect
- File tree navigation (arrow keys)
- Syntax highlighting (ANSI codes in terminal)
- File watching for live updates
- Runs as long-lived TUI process

### pok learn
- Interactive menu (existing prompter)
- Executes shell commands (touch, write files)
- Runs other pok commands
- Streams output as it happens

### Playground
- Two xterm instances
- Both connected to WebContainer
- Coordinated startup (introspect first, then learn)

## Open Questions

1. Syntax highlighting library for terminal?
2. File watching mechanism in WebContainer?
3. How to coordinate the two shell startups?

## Results
(To be filled out)

## Evaluation
(To be filled out)

---

## Results

### Completed Components

1. **`@openpok/introspect` package** - New package with TUI file viewer
   - File tree navigation
   - Syntax highlighting via cli-highlight
   - Live file watching
   - Keyboard controls (j/k navigation, q to quit)

2. **Redesigned `pok learn` command** - Action-based, not explanation-based
   - Four menu options: Create, Arguments, Tabs, Explore
   - Each option executes immediately, shows code, runs command
   - Minimal text, maximum doing

3. **Two-terminal playground layout**
   - Left: `pok learn` (action)
   - Right: `pok introspect` (evidence)
   - Side-by-side with border separator

4. **Whimsical loading states**
   - Bouncing dots animation
   - Rotating silly messages ("Waking up the hamsters...", etc.)

### Verification

All features tested and working:
- Loading screen is fun and whimsical
- Two terminals appear side by side
- Learn command creates files, runs commands
- Introspect shows files with syntax highlighting
- File changes appear in introspect immediately
- Navigation works in both terminals

### Known Issues

- Monorepo build (`pnpm build`) has a pre-existing circular dependency issue (not caused by this work)
- Playground works independently via `pnpm --filter @openpok/playground dev`

## Evaluation

The hypothesis was correct:
- **Do, then understand** works better than explain, then do
- Two-terminal layout provides clear cause/effect visibility
- Action-based learn command is more engaging than tutorial-style
- Whimsical loading makes the wait feel shorter

The playground now demonstrates pok's power through pok itself.
