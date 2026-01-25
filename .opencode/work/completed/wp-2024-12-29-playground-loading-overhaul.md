# Playground Loading Experience Overhaul

## Problem

The loading experience (5-10 seconds) is currently a "dead zone" with only a basic spinner and static text. Users may bounce before experiencing the product. This is the #1 UX issue identified.

## Scope

- `playground/src/components/LoadingScreen.tsx`
- `playground/src/index.css` (loading styles)
- `playground/src/hooks/useWebContainer.ts` (status states)

## Approach

### 1. Branded Loading Spinner

Replace the basic border spinner with a more distinctive dual-ring animation:

- Outer ring rotates clockwise
- Inner ring rotates counter-clockwise (subtle)
- Use accent color with opacity variations

### 2. Dynamic Status Messages

Add typing effect to status text:

- Character-by-character reveal
- Shows activity/progress

### 3. Multi-Phase Progress

Enhance status states to be more granular:

- "Booting WebContainer..."
- "Mounting filesystem..."
- "Starting shell..."
- "Almost ready..."

### 4. Timeout Handling

Add timeout detection:

- After 30s: "Taking longer than expected..."
- After 60s: Transition to error with retry

### 5. Terminal Entry Animation

When loading completes, terminal should fade in with subtle slide:

```css
animation: fadeSlideIn 300ms ease-out;
```

## Hypothesis

An engaging loading experience will:

1. Hold user attention during boot
2. Build anticipation for the product
3. Reduce perceived wait time
4. Feel polished and intentional

Reference the UX review at:
`.opencode/work/in-progress/playground-ux-review.md`

## Results

### Implemented (Phase 2)

**A. Enhanced LoadingScreen.tsx**

- Added "pok" branded wordmark with glow effect
- Implemented typing effect for status messages (40ms per character)
- Added blinking cursor for terminal-like feel
- Updated status messages: "Booting environment..." / "Loading pok..."

**B. Loading CSS Enhancements**

- `.loading-wordmark`: Large branded text with text-shadow glow
- `.loading-spinner`: Dual-ring animation (clockwise + counter-clockwise)
- `.loading-cursor`: Blinking cursor animation

**C. Terminal Entry Animation**

- Added `fadeSlideIn` keyframe animation to `.terminal-container`
- Subtle 8px slide up with opacity transition

**D. Terminal Startup Message**

- Replaced plain "Starting pok..." with ASCII box art
- Blue-colored border with cyan "pok" highlight
- Matches the branded loading experience

### Files Modified

- `playground/src/components/LoadingScreen.tsx`
- `playground/src/components/Terminal.tsx`
- `playground/src/index.css`

### Not Implemented (Future Work)

- Multi-phase progress states (requires changes to useWebContainer.ts)
- Timeout handling with error recovery

## Evaluation

The loading experience now feels intentional and polished rather than a barrier to entry. The typing effect and dual-ring spinner create visual interest during the 5-10 second wait, while the branded wordmark reinforces product identity. The terminal entry animation provides a smooth transition from loading to interactive state.
