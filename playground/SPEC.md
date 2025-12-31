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
+---------------------------------------------+
| pok                          [Menu] [Reset] |  <- Header (40px)
+--------+------------------------------------+
|        |  [pok learn] [shell] [file.ts]     |  <- Tab bar
| FILES  |------------------------------------+
|        |                                    |
| > src/ |  $ pok learn                       |  <- Terminal/Content
|   ...  |                                    |
|        |  Welcome to pok!                   |
|        |                                    |
+--------+------------------------------------+
| Cmd+1-9 Switch | Cmd+B Sidebar | Cmd+K Clear |  <- Footer (desktop only)
+---------------------------------------------+
```

### Component Structure

```
playground/
+-- src/
    +-- App.tsx                 # Main app, keyboard shortcuts, layout
    +-- index.css               # All styles (~1000 lines)
    +-- main.tsx                # Entry point
    +-- components/
    |   +-- FileTree.tsx        # Recursive file tree from WebContainer
    |   +-- FileViewer.tsx      # Syntax-highlighted code viewer
    |   +-- Icons.tsx           # SVG icon components
    |   +-- LoadingScreen.tsx   # Boot loading state
    |   +-- Sidebar.tsx         # Explorer panel (tabs + files)
    |   +-- TabBar.tsx          # Horizontal tab bar
    |   +-- TabContent.tsx      # Tab content wrapper (terminal/file)
    |   +-- Terminal.tsx        # xterm.js wrapper, shell integration
    |   +-- UnsupportedBrowser.tsx
    +-- hooks/
    |   +-- useBrowserSupport.ts  # WebContainer browser check
    |   +-- useEventBus.ts        # Pub/sub for file events
    |   +-- useWebContainer.ts    # WebContainer init + file mounting
    |   +-- useWorkspace.ts       # Tab/sidebar state management
    +-- reporter/
        +-- reporter-web.ts       # Custom reporter for web environment
```

### State Management

#### useWorkspace

Manages the workspace UI state:

```typescript
type WorkspaceState = {
  tabs: Tab[];              // Open tabs (terminals + files)
  activeTabId: string;      // Currently active tab
  splitTabId: string | null; // Split view secondary tab (desktop only)
  sidebarCollapsed: boolean; // Sidebar visibility
  expandedFolders: Set<string>; // Expanded folders in file tree
};
```

Actions:
- `setActiveTab(id)` - Switch to a tab
- `setSplitTab(id | null)` - Toggle split view
- `toggleSidebar()` - Show/hide sidebar
- `openFileTab(path)` - Open file in new tab (or focus existing)
- `closeTab(id)` - Close a closeable tab
- `toggleFolder(path)` - Expand/collapse folder

#### useEventBus

Simple pub/sub for cross-component communication:

```typescript
type PlaygroundEvent =
  | { type: 'file:created'; path: string }
  | { type: 'file:updated'; path: string }
  | { type: 'file:deleted'; path: string }
  | { type: 'clipboard:copy'; content: string }
  | { type: 'tab:open'; filePath: string }
  | { type: 'tree:refresh' };
```

The Terminal component intercepts special OSC escape sequences from pok commands
to emit file events, which the FileTree subscribes to for live updates.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+1, Cmd+2, ... | Switch to tab N |
| Cmd+B | Toggle sidebar |
| Cmd+W | Close active tab (file tabs only) |
| Cmd+K | Clear active terminal |
| Cmd+\ | Toggle split view (desktop only) |

Note: On Windows/Linux, use Ctrl instead of Cmd.

## Responsive Behavior

### Desktop (>=1024px)

- Sidebar visible by default (200px width)
- Tab bar above content
- Split view available
- Keyboard shortcuts shown in footer
- Full header with subtitle

### Mobile (<1024px)

- Sidebar hidden by default
- Hamburger menu button in header
- Clicking hamburger slides sidebar in as overlay
- Sidebar has backdrop that closes it when clicked
- No split view on mobile (too narrow)
- Footer hidden (shortcuts not shown)
- Condensed header (no subtitle)

### Very Small (<480px)

- Sidebar takes most of screen width (100vw - 48px, max 280px)
- Further condensed header elements

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
+-- Your first command
+-- Arguments and flags  
+-- Tabs (multi-process)
+-- How was this made?
+-- Free exploration
```

### Lessons

1. **Your First Command** - Create and run a simple pok command
2. **Arguments and Flags** - Add arguments to a command
3. **Tabs** - Multi-process workflows
4. **How was this made?** - View the tutorial's source code
5. **Free Exploration** - Shell access for experimentation

## Technical Details

### WebContainer Filesystem

```
/
+-- package.json
+-- pok.config.ts
+-- commands/
|   +-- learn.ts
+-- node_modules/  (pre-bundled)
    +-- @pokit/core
    +-- @pokit/prompter-clack
    +-- @pokit/reporter-clack
```

### Terminal Configuration

- Font: Menlo, Monaco, Consolas (monospace)
- Font size: 14px
- Theme: Tokyo Night colors
- Cursor: Blinking block

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| bg-primary | #1a1b26 | Terminal background |
| bg-secondary | #24283b | Header/sidebar background |
| text-primary | #c0caf5 | Main text |
| text-muted | #565f89 | Secondary text |
| accent | #7aa2f7 | Branding, links, active states |
| success | #9ece6a | Success states |
| error | #f7768e | Error states |
| warning | #e0af68 | Warning states, folders |

### Animation Tokens

| Token | Value | Usage |
|-------|-------|-------|
| duration-fast | 100ms | Hover states |
| duration-normal | 200ms | Sidebar, tabs |
| duration-slow | 300ms | Complex transitions |
| ease-out | cubic-bezier(0.16, 1, 0.3, 1) | Smooth easing |

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

## Accessibility

- All interactive elements have visible focus indicators
- Keyboard shortcuts work with both Cmd (Mac) and Ctrl (Windows/Linux)
- ARIA labels on buttons and interactive elements
- Semantic HTML structure
- Color contrast meets WCAG AA standards
