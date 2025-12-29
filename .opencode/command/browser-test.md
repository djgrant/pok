---
description: Test web UI in browser
---

Load the browser skill. Use the iterate skill for hypothesis-driven testing.

## Prerequisites

```bash
# Terminal 1: Start dev server
pok dev interactive

# Terminal 2: Start browser server
python .opencode/skill/browser/screenshot.py start
```

## Workflow

1. Screenshot to see current state
2. Hypothesize what's working or broken
3. Interact to test hypothesis
4. Verify with screenshot
5. Report issues or delegate fixes
