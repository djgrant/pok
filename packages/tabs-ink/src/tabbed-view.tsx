import { Box, Text, useInput, useStdout } from 'ink';
import type { TabProcess } from '@openpok/tabs-core';
import {
  useTabsState,
  useKeyboardCallbackRefs,
  processKeyEvent,
  executeKeyboardAction,
  type NormalizedKeyEvent,
  type KeyboardCallbacks,
} from '@openpok/tabs-core';
import { HelpOverlay } from './help-overlay.js';

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
  helpVisible: boolean;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
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
  showHelpHint,
}: {
  tabCount: number;
  quitConfirmPending: boolean;
  focusMode: boolean;
  showHelpHint: boolean;
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
        {showHelpHint && ' | Press ? for help'}
      </Text>
    </Box>
  );
}

/**
 * Normalize Ink's useInput key event to the shared NormalizedKeyEvent format.
 */
function normalizeInkKeyEvent(input: string, key: {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  pageUp: boolean;
  pageDown: boolean;
}): NormalizedKeyEvent {
  // Map Ink key properties to normalized key names
  let name: string | undefined;
  if (key.escape) name = 'escape';
  else if (key.return) name = 'return';
  else if (key.tab) name = 'tab';
  else if (key.backspace) name = 'backspace';
  else if (key.delete) name = 'delete';
  else if (key.upArrow) name = 'up';
  else if (key.downArrow) name = 'down';
  else if (key.leftArrow) name = 'left';
  else if (key.rightArrow) name = 'right';
  else if (key.pageUp) name = 'pageup';
  else if (key.pageDown) name = 'pagedown';

  return {
    char: input || undefined,
    name,
    ctrl: key.ctrl,
    shift: key.shift,
    meta: key.meta,
  };
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
  helpVisible,
  onToggleHelp,
  onCloseHelp,
}: TabbedViewProps) {
  const { stdout } = useStdout();

  // Calculate view height based on terminal size
  // Reserve space for: padding (2) + tab bar (1) + border (2) + status bar (1) = 6
  const terminalHeight = stdout?.rows ?? 24;
  const viewHeight = Math.max(5, terminalHeight - 6);

  // Use shared tabs state hook
  const {
    showHelpHint,
    activeScrollOffset,
    canScrollUp,
    canScrollDown,
    scrollBy,
    switchTab,
    nextTab,
    prevTab,
  } = useTabsState({
    tabs,
    activeIndex,
    onActiveIndexChange,
    viewHeight,
  });

  // Use shared callback refs hook
  const callbacks: KeyboardCallbacks = {
    onQuit,
    onQuitRequest,
    onRestart,
    onKill,
    onEnterFocusMode,
    onExitFocusMode,
    onSendInput,
    onToggleHelp,
    onCloseHelp,
  };
  const callbackRefs = useKeyboardCallbackRefs(callbacks);

  // Keyboard handling via useInput - always active
  useInput((input, key) => {
    const normalizedEvent = normalizeInkKeyEvent(input, key);
    const action = processKeyEvent(
      normalizedEvent,
      {
        helpVisible,
        focusMode,
        quitConfirmPending,
        activeIndex,
        tabCount: tabs.length,
      },
      viewHeight
    );
    executeKeyboardAction(action, callbackRefs, scrollBy, switchTab, nextTab, prevTab);
  });

  const activeTab = tabs[activeIndex];
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
        showHelpHint={showHelpHint}
      />

      {/* Help overlay - rendered on top */}
      {helpVisible && (
        <Box
          position="absolute"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          width="100%"
          height="100%"
        >
          <HelpOverlay onClose={onCloseHelp} />
        </Box>
      )}
    </Box>
  );
}
