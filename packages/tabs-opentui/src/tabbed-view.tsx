/**
 * Tabbed View Components for OpenTUI
 *
 * UI components for the tabbed terminal interface using OpenTUI primitives.
 */

import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { KeyEvent, ScrollBoxRenderable } from '@opentui/core';
import type { TabProcess } from '@pokjs/tabs-core';
import {
  useTabsState,
  useKeyboardCallbackRefs,
  processKeyEvent,
  executeKeyboardAction,
  type NormalizedKeyEvent,
  type KeyboardCallbacks,
} from '@pokjs/tabs-core';
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
  scrollRef?: (ref: ScrollBoxRenderable | null) => void;
  helpVisible: boolean;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
};

function getStatusIndicator({
  status,
  isActive,
}: {
  status: TabProcess['status'];
  isActive?: boolean;
}) {
  switch (status) {
    case 'running':
      return { color: isActive ? '#00FFFF' : '#008B8B', icon: '\u25CF' };
    case 'done':
      return { color: isActive ? '#00FF00' : '#008000', icon: '\u2713' };
    case 'error':
      return { color: isActive ? '#FF0000' : '#8B0000', icon: '\u2717' };
    case 'stopped':
      return { color: isActive ? '#FFFF00' : '#808000', icon: '\u25A0' };
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
    <box flexDirection="row" gap={1} flexWrap="wrap">
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        const { color, icon } = getStatusIndicator({
          status: tab.status,
          isActive,
        });
        return (
          <box key={tab.id} flexDirection="row">
            <text fg={color}> {icon} </text>
            <box style={isActive ? { backgroundColor: '#444' } : {}}>
              <text fg={isActive ? '#FFF' : '#888'}>
                {' '}
                {tab.label} ({i + 1}){' '}
              </text>
            </box>
          </box>
        );
      })}
      {focusMode && (
        <box style={{ backgroundColor: '#FFFF00' }}>
          <text fg="#000000"> INPUT MODE </text>
        </box>
      )}
    </box>
  );
}

function OutputView({
  lines,
  viewHeight,
  isActive,
  scrollRef,
}: {
  lines: string[];
  viewHeight: number;
  isActive: boolean;
  scrollRef?: (ref: ScrollBoxRenderable | null) => void;
}) {
  return (
    <scrollbox
      ref={scrollRef}
      height={viewHeight}
      scrollY={true}
      focused={isActive}
      viewportCulling={false}
    >
      {lines.map((line, i) => (
        <text key={i}>{line || ' '}</text>
      ))}
    </scrollbox>
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
      <box>
        <box style={{ backgroundColor: '#FFFF00' }}>
          <text fg="#000000"> Press q again to quit, any other key to cancel </text>
        </box>
      </box>
    );
  }

  if (focusMode) {
    return (
      <box flexDirection="row">
        <box style={{ backgroundColor: '#00FFFF' }}>
          <text fg="#000000"> INPUT MODE </text>
        </box>
        <text fg="#666666"> Press Esc to exit input mode</text>
      </box>
    );
  }

  return (
    <box>
      <text fg="#666666">
        [{'\u2191\u2193'}] scroll | [Tab/1-{tabCount}] switch | [i]nput | [r]estart | [k]ill |
        [q]uit{showHelpHint && ' | Press ? for help'}
      </text>
    </box>
  );
}

/**
 * Normalize OpenTUI's KeyEvent to the shared NormalizedKeyEvent format.
 */
function normalizeOpenTUIKeyEvent(event: KeyEvent): NormalizedKeyEvent {
  const { name, ctrl, shift, meta, sequence } = event;

  // Map OpenTUI key names to normalized names
  let normalizedName: string | undefined;
  if (name === 'escape') normalizedName = 'escape';
  else if (name === 'return') normalizedName = 'return';
  else if (name === 'tab') normalizedName = 'tab';
  else if (name === 'backspace') normalizedName = 'backspace';
  else if (name === 'delete') normalizedName = 'delete';
  else if (name === 'up') normalizedName = 'up';
  else if (name === 'down') normalizedName = 'down';
  else if (name === 'left') normalizedName = 'left';
  else if (name === 'right') normalizedName = 'right';
  else if (name === 'pageup') normalizedName = 'pageup';
  else if (name === 'pagedown') normalizedName = 'pagedown';
  else normalizedName = name;

  return {
    char: sequence || undefined,
    name: normalizedName,
    ctrl,
    shift,
    meta,
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
  scrollRef,
  helpVisible,
  onToggleHelp,
  onCloseHelp,
}: TabbedViewProps) {
  const { height: rows } = useTerminalDimensions();

  const terminalHeight = rows ?? 24;
  const viewHeight = Math.max(5, terminalHeight - 6);

  // Use shared tabs state hook
  // Note: OpenTUI's scrollbox handles scrolling natively, so we don't use scrollBy here
  const { showHelpHint, switchTab, nextTab, prevTab, scrollBy } = useTabsState({
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

  useKeyboard((event: KeyEvent) => {
    const normalizedEvent = normalizeOpenTUIKeyEvent(event);
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

    // For OpenTUI, we skip scroll actions since native scrollbox handles them
    if (action.type === 'scroll') {
      // OpenTUI's scrollbox handles up/down/pageup/pagedown natively
      return;
    }

    executeKeyboardAction(action, callbackRefs, scrollBy, switchTab, nextTab, prevTab);
  });

  const activeTab = tabs[activeIndex];
  if (!activeTab) {
    return <text>No tabs available</text>;
  }

  return (
    <box flexDirection="column" padding={1}>
      <TabBar tabs={tabs} activeIndex={activeIndex} focusMode={focusMode} />
      <box
        border={['top', 'bottom']}
        borderStyle="single"
        borderColor="#666666"
        height={viewHeight + 2}
      >
        <OutputView
          lines={activeTab.output}
          viewHeight={viewHeight}
          isActive={true}
          scrollRef={scrollRef}
        />
      </box>
      <StatusBar
        tabCount={tabs.length}
        quitConfirmPending={quitConfirmPending}
        focusMode={focusMode}
        showHelpHint={showHelpHint}
      />

      {/* Help overlay - rendered on top */}
      {helpVisible && (
        <box
          position="absolute"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          width="100%"
          height="100%"
        >
          <HelpOverlay onClose={onCloseHelp} />
        </box>
      )}
    </box>
  );
}
