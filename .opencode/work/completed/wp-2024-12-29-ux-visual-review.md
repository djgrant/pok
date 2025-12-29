# UX Visual Review: Playground & Introspect

**Date**: 2024-12-29
**Status**: In Progress
**Reviewer**: Claude (UX Tester)

---

## Problem

User reported visual issues with the playground:
- "issues with UI, TUI elements lining up"
- "legibility of file previews in standard CLI"

This work package documents specific issues found through visual testing.

## Scope

- `playground/` - Web-based interactive tutorial
- `packages/introspect/` - TUI file browser component

---

## Findings

### Issue 1: Status Bar Text Wrapping/Corruption (CRITICAL)

**Location**: Right panel (introspect), bottom status bar

**Observed**: The status bar displays garbled text:
```
└[↑↓/jk] navigate  [Enter] expand  [PgUp/PgDn] scroll  [?] help  [q] q
uitintrospect.ts┘
```

**Expected**:
```
└[↑↓/jk] navigate  [Enter] expand  [PgUp/PgDn] scroll  [?] help  [q] quit        introspect.ts┘
```

**Root Cause**: 
In `packages/introspect/src/render.ts` line 171:
```typescript
const controls = '[↑↓/jk] navigate  [Enter] expand  [PgUp/PgDn] scroll  [?] help  [q] quit';
```

The controls string is **76 characters** long. When combined with filename and borders, it exceeds the available terminal width (~70 columns in the playground's split view).

The terminal has approximately 70 columns per pane (640px width / ~9px per character). The status bar calculation doesn't account for narrow terminals, causing line wrap.

**Evidence**: DOM inspection shows terminal pane width is 640px with approximately 70 character columns.

**Severity**: Critical - Makes the UI appear broken/buggy

**Recommended Fix**:
1. Shorten the controls string for narrow terminals
2. Add responsive handling in `renderStatusBar()`:
```typescript
function renderStatusBar(state: IntrospectState, cols: number): string {
  // Use abbreviated controls for narrow terminals
  const controls = cols < 80 
    ? '[↑↓] nav  [Enter] expand  [?] help  [q] quit'
    : '[↑↓/jk] navigate  [Enter] expand  [PgUp/PgDn] scroll  [?] help  [q] quit';
  // ... rest of function
}
```

---

### Issue 2: Status Bar Text Cutoff at Right Edge

**Location**: Right panel status bar, rightmost text

**Observed**: `[q] q` appears instead of `[q] quit`

**Root Cause**: Same as Issue 1 - terminal width insufficient for full status bar

**Severity**: Medium - Affects usability but not critical

---

### Issue 3: Spec Deviation - Split View vs Single Terminal

**Location**: `playground/src/App.tsx` lines 59-69

**Observed**: The playground shows two terminal panes side-by-side:
- Left: `pok learn` command
- Right: `pok introspect` command

**Spec Says** (from `playground/SPEC.md` lines 10-11):
> "1. **Terminal is king** - One full-screen terminal. No sidebars, no panels, no split views."

**Impact**: 
- Reduces available width per terminal (640px each vs 1280px)
- Causes the status bar issues documented above
- Deviates from documented design philosophy

**Severity**: Medium - Intentional design change that causes downstream issues

**Recommendation**: Either:
1. Return to single-terminal design per spec
2. Update spec to reflect current dual-terminal design
3. Make introspect responsive to narrow widths

---

### Issue 4: Line Number Column Alignment

**Location**: Right panel file preview area

**Observed**: Line numbers 1-41 are right-aligned but the code content column has varying indentation

**Code Analysis** (`render.ts` lines 150-161):
```typescript
const lineNumWidth = String(contentLines.length).length + 1;
// ...
const lineNum = String(lineIndex + 1).padStart(lineNumWidth, ' ');
```

This is working correctly - line numbers ARE right-aligned. The visual "misalignment" perception comes from:
1. Variable code indentation (some lines have 0, 2, 4+ spaces)
2. The `│` separator between line number and code

**Severity**: Low/Cosmetic - Actually working as intended

---

### Issue 5: Code Line Truncation

**Location**: Right panel file preview

**Observed**: Long lines are truncated with `…` character (e.g., lines 1, 3, 6, 7, 17, 34)

**Code** (`render.ts` lines 158-160):
```typescript
const maxCodeWidth = cols - lineNumWidth - 5;
const truncatedCode =
  codeLine.length > maxCodeWidth ? codeLine.slice(0, maxCodeWidth - 1) + '\u2026' : codeLine;
```

**Analysis**: This is intentional behavior to prevent horizontal overflow. The truncation is working correctly.

**Severity**: Low - Working as designed, though readability is reduced

**Potential Enhancement**: Add horizontal scrolling capability for code preview (stretch goal)

---

### Issue 6: File Tree Icons Rendering

**Location**: Right panel file list

**Observed**: File icons (📄) and folder icons (📁) render correctly with proper spacing

**Severity**: None - Working correctly

---

### Issue 7: Panel Focus/Keyboard Routing

**Location**: Both terminal panes

**Observed**: 
- Initially, keyboard input goes to the RIGHT panel (introspect)
- Need to click on LEFT panel to focus `pok learn` menu
- After clicking, arrow keys work correctly

**Root Cause**: The second terminal (`pok introspect`) has `startDelay={200}` and receives focus after initialization.

**Severity**: Low - Minor UX friction, user can click to focus

**Potential Fix**: Add visual focus indicator or auto-focus the left panel

---

## Visual Evidence

Screenshots saved to:
- `.opencode/work/in-progress/screenshot-1-main-view.png` - Initial playground view
- `.opencode/work/in-progress/screenshot-2-status-bar-issue.png` - Status bar corruption detail

---

## Summary of Issues by Severity

| Severity | Issue | Impact |
|----------|-------|--------|
| **Critical** | Status bar text wrapping | UI appears broken |
| **Medium** | Status bar text cutoff | Minor functionality loss |
| **Medium** | Spec deviation (split view) | Root cause of width issues |
| **Low** | Panel focus routing | Minor UX friction |
| **Low** | Code truncation | Reduced readability |
| **None** | Line numbers, icons | Working correctly |

---

## Recommended Actions

### Immediate Fix (Critical)
1. Update `packages/introspect/src/render.ts` to handle narrow terminals:
   - Shorten status bar text when cols < 80
   - Or remove filename from status bar in narrow mode

### Short-term
2. Decide on spec vs implementation:
   - Either revert to single terminal per spec
   - Or update spec and make introspect responsive

### Nice-to-have
3. Add visual focus indicator to terminal panes
4. Consider horizontal scroll for code preview

---

## Hypothesis

The primary visual issues stem from the introspect TUI being designed for standard terminal widths (80+ columns) but being displayed in a ~70 column split-pane context in the playground. Fixing the responsive behavior in `render.ts` will resolve the critical status bar issues.

## Results

*To be filled after fixes are implemented*

## Evaluation

*To be filled after verification*
