---
name: browser
description: Interact with and test local web applications using Playwright. Take screenshots, click elements, type text, and inspect the DOM.
---

# Browser Interaction

For testing and developing web applications (particularly `packages/website-interactive`), use the browser tool.

**Run `screenshot.py --help` first** to see all available commands. Use the script as a black box rather than reading its source.

## Setup

The tool uses a persistent browser server for fast interactions:

```bash
# Terminal 1: Start your dev server
pok dev interactive

# Terminal 2: Start the browser server
python .opencode/skill/browser/screenshot.py start
```

## Quick Reference

```bash
python .opencode/skill/browser/screenshot.py <command> [args]
```

| Command | Description |
|---------|-------------|
| `start` | Start browser server (run first, blocks) |
| `stop` | Stop browser server |
| `status` | Check if server is running |
| `screenshot [--wait N]` | Take screenshot |
| `click <selector>` | Click element |
| `type <selector> <text>` | Type into input |
| `press <key>` | Press key (Enter, Tab, etc.) |
| `list <selector>` | List matching elements |
| `text <selector>` | Get element text |

## Workflow

1. **Screenshot** to see current state
2. **List elements** to discover selectors
3. **Interact** with discovered selectors
4. **Screenshot** to verify result

## Example Session

```bash
# See what's on screen
python .opencode/skill/browser/screenshot.py screenshot --wait 2

# Find buttons
python .opencode/skill/browser/screenshot.py list "button"

# Click first lesson
python .opencode/skill/browser/screenshot.py click ".lesson-item:first-child"

# Type in terminal and submit
python .opencode/skill/browser/screenshot.py type ".terminal-input" "pok build"
python .opencode/skill/browser/screenshot.py press Enter
```

## Screenshots

Screenshots save to `.screenshots/screenshot.png` (gitignored). Each interaction auto-captures after completing.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_URL` | `http://localhost:5173` | Dev server URL |
| `BROWSER_WIDTH` | `1280` | Viewport width |
| `BROWSER_HEIGHT` | `800` | Viewport height |
