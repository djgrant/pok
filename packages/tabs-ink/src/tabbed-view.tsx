import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useStdout, useStdin } from 'ink';
import { appendFileSync } from 'node:fs';
import type { TabProcess } from './types.js';

// DEBUG: Write to a log file since console output is hidden in alternate screen
const debugLog = (msg: string) => {
  appendFileSync('/tmp/tabs-debug.log', `${new Date().toISOString()} ${msg}\n`);
};

type TabbedViewProps = {
  tabs: TabProcess[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onQuit: () => void;
  onQuitRequest: () => void;
  onRestart: (index: number) => void;
  onKill: (index: number) => void;
  quitConfirmPending: boolean;
  focusMode: boolean;
  onEnterFocusMode: () => void;
  onExitFocusMode: () => void;
  onSendInput: (data: string) => void;
};

function getStatusIndicator({
  status,
  inverse,
}: {
  status: TabProcess['status'];
  inverse?: boolean;
}) {
  switch (status) {
    case 'running':
      return { color: inverse ? 'cyanBright' : 'cyan', icon: '●' };
    case 'done':
      return { color: inverse ? 'greenBright' : 'green', icon: '✓' };
    case 'error':
      return { color: inverse ? 'redBright' : 'red', icon: '✗' };
    case 'stopped':
      return { color: inverse ? 'yellowBright' : 'yellow', icon: '■' };
  }
}

function TabBar({
  tabs,
  activeIndex,
  focusMode,
}: {
  tabs: TabProcess[];
  activeIndex: number;
  focusMode: boolean;
}) {
  return (
    <Box gap={1} flexWrap="wrap">
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        const { color, icon } = getStatusIndicator({
          status: tab.status,
          inverse: isActive,
        });
        return (
          <Box key={tab.id}>
            <Text inverse={isActive} color={color}>
              {' '}
              {icon}{' '}
            </Text>
            <Text inverse={isActive}> {tab.label}</Text>
            <Text inverse={isActive}>
              {' ('}
              {i + 1}
              {') '}
            </Text>
          </Box>
        );
      })}
      {focusMode && (
        <Text backgroundColor="yellow" color="black">
          {' INPUT MODE '}
        </Text>
      )}
    </Box>
  );
}

function OutputView({
  lines,
  scrollOffset,
  viewHeight,
  canScrollUp,
  canScrollDown,
}: {
  lines: string[];
  scrollOffset: number;
  viewHeight: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
}) {
  const visibleLines = lines.slice(scrollOffset, scrollOffset + viewHeight);

  return (
    <Box flexDirection="column" height={viewHeight} overflow="hidden">
      {visibleLines.map((line, i) => {
        // Show scroll indicator on first two lines
        let prefix = '  ';
        if (i === 0 && canScrollUp) prefix = '↑ ';
        else if (i === 1 && canScrollDown) prefix = '↓ ';

        return (
          <Text key={i} wrap="truncate" dimColor={i < 2 && prefix !== '  '}>
            <Text dimColor>{prefix}</Text>
            <Text>{line || ' '}</Text>
          </Text>
        );
      })}
      {/* Fill remaining space with empty lines */}
      {Array.from({
        length: Math.max(0, viewHeight - visibleLines.length),
      }).map((_, i) => {
        const lineIndex = visibleLines.length + i;
        let prefix = '  ';
        if (lineIndex === 0 && canScrollUp) prefix = '↑ ';
        else if (lineIndex === 1 && canScrollDown) prefix = '↓ ';

        return (
          <Text key={`empty-${i}`}>
            <Text dimColor>{prefix}</Text>
            <Text> </Text>
          </Text>
        );
      })}
    </Box>
  );
}

function StatusBar({
  tabCount,
  quitConfirmPending,
  focusMode,
}: {
  tabCount: number;
  quitConfirmPending: boolean;
  focusMode: boolean;
}) {
  if (quitConfirmPending) {
    return (
      <Box>
        <Text backgroundColor="yellow" color="black">
          {' '}
          Press q again to quit, any other key to cancel{' '}
        </Text>
      </Box>
    );
  }

  if (focusMode) {
    return (
      <Box>
        <Text backgroundColor="cyan" color="black">
          {' '}
          INPUT MODE{' '}
        </Text>
        <Text dimColor> Press Esc to exit input mode</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text dimColor>
        [↑↓] scroll | [Tab/1-{tabCount}] switch | [i]nput | [r]estart | [k]ill | [q]uit
      </Text>
    </Box>
  );
}

export function TabbedView({
  tabs,
  activeIndex,
  onActiveIndexChange,
  onQuit,
  onQuitRequest,
  onRestart,
  onKill,
  quitConfirmPending,
  focusMode,
  onEnterFocusMode,
  onExitFocusMode,
  onSendInput,
}: TabbedViewProps) {
  const { stdout } = useStdout();
  const { isRawModeSupported, stdin } = useStdin();

  // DEBUG: Log stdin state from inside the component
  useEffect(() => {
    debugLog(`[TabbedView] isRawModeSupported: ${isRawModeSupported}`);
    debugLog(`[TabbedView] stdin.isRaw: ${stdin?.isRaw}`);
    debugLog(`[TabbedView] stdin.isPaused: ${stdin?.isPaused?.()}`);
  }, [isRawModeSupported, stdin]);
  const [scrollOffsets, setScrollOffsets] = useState<Map<string, number>>(() => new Map());
  const [autoScroll, setAutoScroll] = useState<Map<string, boolean>>(
    () => new Map(tabs.map((t) => [t.id, true]))
  );

  // Calculate view height based on terminal size
  // Reserve space for: padding (2) + tab bar (1) + border (2) + status bar (1) = 6
  const terminalHeight = stdout?.rows ?? 24;
  const viewHeight = Math.max(5, terminalHeight - 6);

  const activeTab = tabs[activeIndex];
  const activeScrollOffset = scrollOffsets.get(activeTab?.id ?? '') ?? 0;

  // Calculate scroll state
  const totalLines = activeTab?.output.length ?? 0;
  const maxScroll = Math.max(0, totalLines - viewHeight);
  const canScrollUp = activeScrollOffset > 0;
  const canScrollDown = activeScrollOffset < maxScroll;

  // Auto-scroll when new output arrives (if auto-scroll enabled for this tab)
  useEffect(() => {
    if (!activeTab) return;
    const shouldAutoScroll = autoScroll.get(activeTab.id) ?? true;
    if (shouldAutoScroll) {
      const maxScroll = Math.max(0, activeTab.output.length - viewHeight);
      setScrollOffsets((prev) => {
        const next = new Map(prev);
        next.set(activeTab.id, maxScroll);
        return next;
      });
    }
  }, [activeTab, viewHeight, autoScroll]);

  const scrollBy = useCallback(
    (delta: number) => {
      if (!activeTab) return;
      const maxScroll = Math.max(0, activeTab.output.length - viewHeight);
      setScrollOffsets((prev) => {
        const next = new Map(prev);
        const current = prev.get(activeTab.id) ?? 0;
        const newOffset = Math.max(0, Math.min(maxScroll, current + delta));
        next.set(activeTab.id, newOffset);

        // If scrolled away from bottom, disable auto-scroll
        // If scrolled to bottom, re-enable auto-scroll
        const atBottom = newOffset >= maxScroll;
        setAutoScroll((as) => {
          const asNext = new Map(as);
          asNext.set(activeTab.id, atBottom);
          return asNext;
        });

        return next;
      });
    },
    [activeTab, viewHeight]
  );

  const switchTab = useCallback(
    (newIndex: number) => {
      if (newIndex >= 0 && newIndex < tabs.length) {
        onActiveIndexChange(newIndex);
      }
    },
    [tabs.length, onActiveIndexChange]
  );

  // Use refs for callbacks to ensure fresh values in useInput
  const onQuitRef = useRef(onQuit);
  const onQuitRequestRef = useRef(onQuitRequest);
  const onRestartRef = useRef(onRestart);
  const onKillRef = useRef(onKill);
  const onEnterFocusModeRef = useRef(onEnterFocusMode);
  const onExitFocusModeRef = useRef(onExitFocusMode);
  const onSendInputRef = useRef(onSendInput);

  useEffect(() => {
    onQuitRef.current = onQuit;
    onQuitRequestRef.current = onQuitRequest;
    onRestartRef.current = onRestart;
    onKillRef.current = onKill;
    onEnterFocusModeRef.current = onEnterFocusMode;
    onExitFocusModeRef.current = onExitFocusMode;
    onSendInputRef.current = onSendInput;
  }, [onQuit, onQuitRequest, onRestart, onKill, onEnterFocusMode, onExitFocusMode, onSendInput]);

  // DEBUG: Log that useInput callback is being registered
  debugLog('useInput hook registered');

  // Keyboard handling via useInput - always active
  useInput((input, key) => {
    // DEBUG: Log every keypress
    debugLog(`useInput received: ${JSON.stringify({ input, key })}`);
    // Focus mode: forward most input to child process
    if (focusMode) {
      // Escape exits focus mode
      if (key.escape) {
        onExitFocusModeRef.current();
        return;
      }

      // Build the raw input string to send to child process
      // For special keys, we need to send the appropriate escape sequences
      let rawInput = input;

      if (key.return) {
        rawInput = '\n';
      } else if (key.tab) {
        rawInput = '\t';
      } else if (key.backspace) {
        rawInput = '\x7f'; // DEL character
      } else if (key.delete) {
        rawInput = '\x1b[3~'; // Delete key escape sequence
      } else if (key.upArrow) {
        rawInput = '\x1b[A';
      } else if (key.downArrow) {
        rawInput = '\x1b[B';
      } else if (key.rightArrow) {
        rawInput = '\x1b[C';
      } else if (key.leftArrow) {
        rawInput = '\x1b[D';
      } else if (key.ctrl && input) {
        // Ctrl+key combinations
        const code = input.toUpperCase().charCodeAt(0) - 64;
        if (code >= 1 && code <= 26) {
          rawInput = String.fromCharCode(code);
        }
      }

      if (rawInput) {
        onSendInputRef.current(rawInput);
      }
      return;
    }

    // Normal mode: handle UI navigation

    // If quit confirmation pending, handle it specially
    if (quitConfirmPending) {
      if (input === 'q') {
        onQuitRef.current();
      } else {
        // Any other key cancels (handled by parent resetting state)
        onQuitRequestRef.current(); // This will toggle it off
      }
      return;
    }

    // Quit request
    if (input === 'q') {
      onQuitRequestRef.current();
      return;
    }

    // Ctrl+C for instant quit (no confirmation)
    if (input === 'c' && key.ctrl) {
      onQuitRef.current();
      return;
    }

    // Enter focus/input mode
    if (input === 'i') {
      onEnterFocusModeRef.current();
      return;
    }

    // Restart current tab
    if (input === 'r') {
      onRestartRef.current(activeIndex);
      return;
    }

    // Kill current tab's process
    if (input === 'k') {
      onKillRef.current(activeIndex);
      return;
    }

    // Number keys 1-9 for direct tab access
    const num = parseInt(input, 10);
    if (num >= 1 && num <= tabs.length) {
      switchTab(num - 1);
      return;
    }

    // Tab navigation
    if (key.tab && key.shift) {
      switchTab((activeIndex - 1 + tabs.length) % tabs.length);
      return;
    }
    if (key.tab) {
      switchTab((activeIndex + 1) % tabs.length);
      return;
    }

    // Arrow key tab navigation
    if (key.leftArrow && key.meta) {
      switchTab((activeIndex - 1 + tabs.length) % tabs.length);
      return;
    }
    if (key.rightArrow && key.meta) {
      switchTab((activeIndex + 1) % tabs.length);
      return;
    }

    // Scrolling
    if (key.upArrow) {
      scrollBy(-1);
      return;
    }
    if (key.downArrow) {
      scrollBy(1);
      return;
    }
    if (key.pageUp) {
      scrollBy(-viewHeight);
      return;
    }
    if (key.pageDown) {
      scrollBy(viewHeight);
      return;
    }
  });

  if (!activeTab) {
    return <Text>No tabs available</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <TabBar tabs={tabs} activeIndex={activeIndex} focusMode={focusMode} />
      <Box
        borderLeft={false}
        borderRight={false}
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        <OutputView
          lines={activeTab.output}
          scrollOffset={activeScrollOffset}
          viewHeight={viewHeight}
          canScrollUp={canScrollUp}
          canScrollDown={canScrollDown}
        />
      </Box>
      <StatusBar
        tabCount={tabs.length}
        quitConfirmPending={quitConfirmPending}
        focusMode={focusMode}
      />
    </Box>
  );
}
