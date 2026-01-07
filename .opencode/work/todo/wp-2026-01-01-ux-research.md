# UX Research: User Experience and Terminal Interface

## Problem

pok is "the TanStack of command line apps" and needs a polished, professional terminal UX to match this positioning. This research identifies opportunities to improve the user experience across reporters, prompters, and tabbed interfaces.

## Scope

Packages examined:
- `packages/reporter-clack/` - Terminal output rendering
- `packages/prompter-clack/` - Interactive prompts
- `packages/tabs-ink/` - Ink-based tabbed UI
- `packages/tabs-opentui/` - OpenTUI-based tabbed UI
- `packages/tabs-core/` - Shared tabbed UI logic
- `packages/reporter-web/` - Web reporter components
- `playground/` - Visual demonstration and tutorials

## Approach

Thorough code review of all UX-related components, examining:
1. Visual design patterns and consistency
2. Interactive prompt implementations
3. Progress and status reporting
4. Error display and remediation
5. Color usage and accessibility
6. Terminal compatibility and fallback modes
7. Responsive design and resize handling
8. Tabbed interface experience

## Hypothesis

The current UX implementation is functional but has opportunities for improvement in:
- Visual polish and consistency
- Accessibility features
- Interactive feedback
- Error presentation
- Cross-terminal compatibility

---

## Results

### 1. Visual Design Assessment

#### Current Strengths
- **Unicode symbols**: Well-chosen set (◇, ■, ▲, ●, ✔, ✘) with ASCII fallbacks
- **Box drawing**: Clean group boundaries with ┌, └, │ characters
- **Color scheme**: Semantic colors (green=success, red=error, yellow=warning, cyan=info)
- **Clack integration**: Leverages battle-tested @clack/prompts library

#### Opportunities for Improvement

**A. Symbol Consistency Issue**
The symbols file (`symbols.ts`) shows inconsistent icon choices:
- Success uses ◇ (diamond) but Done uses ✔ (checkmark)
- This creates visual confusion between "completed activity" vs "group done"

```typescript
// Current (inconsistent)
success: '\u25C7', // ◇
done: '\u2714',    // ✔

// Suggested (consistent)
success: '\u2714', // ✔
done: '\u2714',    // ✔
```

**B. Status Indicator Inconsistency Across Packages**
- `tabs-ink` uses different colors than `tabs-opentui`
- `tabs-ink` uses Ink's named colors (`cyan`, `green`)
- `tabs-opentui` uses hex colors (`#00FFFF`, `#00FF00`)
- `tabs-core` defines `STATUS_INDICATORS` but not all adapters use them

**C. No Theming System**
Currently colors are hardcoded. A theme system would allow:
- User customization
- High-contrast mode
- Colorblind-friendly palettes

### 2. Interactive Prompts Assessment

#### Current Strengths
- Clean wrapper around @clack/prompts
- Proper Ctrl+C handling (exits cleanly)
- Supports select, multiselect, confirm, and text prompts
- Well-documented behavioral contract in types

#### Opportunities for Improvement

**A. Limited Prompt Types**
The Prompter interface only supports 4 prompt types:
- `select` - Single selection
- `multiselect` - Multiple selection
- `confirm` - Yes/no
- `text` - Free text input

Missing commonly-needed prompts:
- `password` - Masked text input
- `autocomplete` - Fuzzy search selection
- `number` - Numeric input with validation
- `date` - Date picker
- `spinner` - Interactive wait with cancel
- `toggle` - Boolean toggle (different UX than confirm)

**B. No Progress Callback During Prompts**
Cannot show progress while waiting for user input (e.g., "Loading options...")

**C. Validation UX**
Text validation shows error message but no inline feedback as user types

### 3. Progress Reporting Assessment

#### Current Strengths
- Spinners for active tasks via clack
- Activity updates support progress percentage
- Log buffering during spinners (prevents interleaving)
- Parallel group progress tracking

#### Opportunities for Improvement

**A. No Progress Bars**
Activities only show spinner or percentage text, no visual progress bar:
```
Current:    ◓  Installing dependencies... 45%
Suggested:  ◓  Installing dependencies [████████░░░░░░░░] 45%
```

**B. No ETA/Time Elapsed**
Long-running tasks don't show duration or estimated time remaining

**C. Limited Activity Update Payload**
`activity:update` only supports `message` and `progress`:
```typescript
// Could expand to include:
type ActivityUpdate = {
  message?: string;
  progress?: number;
  eta?: number;        // Seconds remaining
  speed?: string;      // "2.5 MB/s"
  subActivity?: string; // "Processing file 3 of 10"
};
```

**D. No Indeterminate Progress**
No way to show "working but unknown completion %" differently from "0% progress"

### 4. Error Display Assessment

#### Current Strengths
- Errors marked with ■ symbol in red
- Error messages displayed after spinner stop
- Remediation steps supported (with - bullet points)
- Documentation URL support

#### Opportunities for Improvement

**A. Error Formatting Could Be Richer**
Current remediation display:
```
│
│     To fix:
│       - Run npm install
│       - Check your .env file
```

Could be improved with:
- Box around remediation section
- Numbered steps instead of bullets
- Syntax highlighting for commands
- Clickable links in supported terminals

**B. No Error Categorization**
All errors look the same. Could differentiate:
- User errors (fixable)
- System errors (report to admin)
- Network errors (retry)

**C. No Stack Trace Formatting**
Stack traces render as plain text. Could:
- Collapse to one line with expand option
- Highlight source files vs node_modules
- Link to source files (in supported terminals)

### 5. Color Usage and Accessibility

#### Current Strengths
- NO_COLOR env var support (https://no-color.org)
- `--no-color` and `--plain` CLI flags
- FORCE_COLOR support for CI
- Semantic color usage (not just decorative)

#### Opportunities for Improvement

**A. No Colorblind-Friendly Mode**
Red/green colorblindness (deuteranopia) affects 8% of men.
Current success (green) and error (red) may be indistinguishable.

Suggested additions:
- Shape differentiation (already have ✔ vs ✘, but need consistency)
- Alternative palette: blue for success, orange for error
- `--colorblind` flag or `POK_COLORBLIND=1` env var

**B. No High-Contrast Mode**
For users with low vision, brighter colors could help:
- `--high-contrast` flag
- Uses bright versions of all colors

**C. Dim Colors May Be Too Dim**
`dimColor` used for hints may be invisible on some terminals

### 6. Terminal Compatibility Assessment

#### Current Strengths
- TTY detection for both stdout and stdin
- CI environment detection
- TERM=dumb detection
- Plain mode with ASCII fallbacks
- Documented terminal requirements

#### Opportunities for Improvement

**A. No Terminal Capability Detection**
Currently guesses based on TERM variable. Could use:
- `supports-color` npm package for accurate color detection
- Unicode test character to check rendering
- Terminal feature detection (256 color, true color, hyperlinks)

**B. Missing Hyperlink Support**
Modern terminals (iTerm2, Warp, Windows Terminal) support clickable links:
```
\x1b]8;;https://example.com\x1b\\Link Text\x1b]8;;\x1b\\
```
Could use for documentation URLs and file paths.

**C. No tmux/screen Detection**
Multiplexer environments may have different capabilities

**D. Windows Console Limitations**
No specific handling for legacy Windows console (cmd.exe)
- Unicode may require `chcp 65001`
- Colors may need `FORCE_COLOR`

### 7. Responsive Design Assessment

#### Current Strengths
- Tabs UI calculates view height from terminal rows
- Output truncation with `wrap="truncate"`
- Status bar adapts to space

#### Opportunities for Improvement

**A. No Terminal Resize Handling in Reporter**
Reporter-clack doesn't handle `SIGWINCH` for resize events.
Spinner messages may overflow on narrow terminals.

**B. Tabs Minimum Size Not Enforced**
Docs recommend 100x30 but UI doesn't enforce or warn:
```
Current:    UI renders badly on 40x20
Suggested:  Show warning or simplified view
```

**C. No Responsive Breakpoints**
Could adapt layout based on width:
- < 60 cols: Minimal mode (no box borders)
- 60-80 cols: Standard mode
- > 80 cols: Rich mode (full progress bars)

**D. Long Label Truncation**
Activity labels can overflow:
```
Current:    ◓  Installing @very-long-scoped-package/some-very-long-name-here...
Suggested:  ◓  Installing @very-long.../some-very-l...
```

### 8. Tabbed Interface Assessment

#### Current Strengths
- Two implementations: Ink and OpenTUI
- Shared logic in tabs-core (DRY)
- Comprehensive keyboard shortcuts
- Help overlay with ?
- Focus/input mode for child processes
- Ring buffer for output (10,000 lines)
- Batched output updates (16ms)
- Scroll state per tab
- Auto-scroll with disable on manual scroll
- Error boundary with terminal cleanup
- Graceful signal handling

#### Opportunities for Improvement

**A. No Tab Reordering**
Tabs are in fixed order. Could allow drag-reorder (in supported terminals)

**B. No Tab Closing**
Can kill process but tab remains. Could allow closing tabs entirely.

**C. No Tab Renaming**
Cannot rename tabs at runtime

**D. Limited Tab Bar**
With many tabs, bar wraps but doesn't scroll:
```
Current:    [1] dev ● [2] api ● [3] db ● [4] redis ●
            [5] worker ● [6] scheduler ●
Could be:   ← [3] db ● [4] redis ● [5] worker ● →
```

**E. No Split View**
Cannot view two tabs simultaneously

**F. Search/Filter Missing**
Cannot search within tab output or filter by regex

**G. No Output Copy**
Cannot copy tab output to clipboard

**H. No Timestamp Toggle**
Could show timestamps per line for debugging

**I. Process Metrics Missing**
Could show CPU/memory usage per tab (if available)

---

## Evaluation

### Summary of Key Findings

| Area | Current State | Priority | Effort |
|------|--------------|----------|--------|
| Visual Consistency | Symbols inconsistent | High | Low |
| Progress Bars | Not implemented | Medium | Medium |
| Colorblind Support | Not implemented | High | Low |
| Terminal Links | Not implemented | Low | Low |
| Prompt Types | Limited to 4 | Medium | Medium |
| Error Formatting | Basic | Medium | Medium |
| Resize Handling | Partial | Medium | Medium |
| Tab Search | Not implemented | Low | High |
| Tab Metrics | Not implemented | Low | High |

### Prioritized Recommendations

#### High Priority (Should Fix)

1. **Symbol Consistency** - Unify success/done symbols across packages
2. **Colorblind Mode** - Add shape differentiation and alternative palette
3. **Terminal Capability Detection** - Use proper detection libraries

#### Medium Priority (Nice to Have)

4. **Progress Bars** - Visual progress indication for long tasks
5. **Richer Error Display** - Boxed remediation, syntax highlighting
6. **Password Prompt** - Essential for many CLI tools
7. **Resize Handling** - Proper SIGWINCH handling

#### Low Priority (Future Enhancements)

8. **Hyperlink Support** - Clickable URLs in error messages
9. **Tab Search** - Regex filter for tab output
10. **Theming System** - User-customizable color themes

### Architecture Observations

The UX architecture is well-designed:
- Clean separation: Core defines interfaces, adapters implement
- Shared logic in tabs-core prevents duplication
- Event-based reporter allows multiple output targets
- Output config is cleanly abstracted

The main weakness is inconsistency between packages (e.g., colors defined differently in tabs-ink vs tabs-opentui). A centralized theme/design-tokens system would help.

### Comparison to Best-in-Class

| Feature | pok | Ink | Clack | Inquirer |
|---------|-----|-----|-------|----------|
| Spinners | ✓ | ✓ | ✓ | ✓ |
| Progress bars | ✗ | ✓ | ✗ | ✓ |
| Colorblind mode | ✗ | ✗ | ✗ | ✗ |
| Password prompt | ✗ | ✓ | ✓ | ✓ |
| Autocomplete | ✗ | ✓ | ✗ | ✓ |
| Theming | ✗ | ✓ | ✗ | ✓ |
| Hyperlinks | ✗ | ✗ | ✗ | ✗ |

pok is on par with clack (which it wraps) but behind Ink and Inquirer in features.
However, pok's event-driven architecture and tabs system are unique strengths.
