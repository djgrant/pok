/**
 * Tabbed View Components for OpenTUI
 *
 * UI components for the tabbed terminal interface using OpenTUI primitives.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { KeyEvent, ScrollBoxRenderable } from '@opentui/core';
import type { TabProcess } from '@openpok/tabs-core';

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
}: {
  tabCount: number;
  quitConfirmPending: boolean;
  focusMode: boolean;
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
        [q]uit
      </text>
    </box>
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
  scrollRef,
}: TabbedViewProps) {
  const { height: rows } = useTerminalDimensions();

  const terminalHeight = rows ?? 24;
  const viewHeight = Math.max(5, terminalHeight - 6);

  const activeTab = tabs[activeIndex];

  const switchTab = useCallback(
    (newIndex: number) => {
      if (newIndex >= 0 && newIndex < tabs.length) {
        onActiveIndexChange(newIndex);
      }
    },
    [tabs.length, onActiveIndexChange]
  );

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

  useKeyboard((event: KeyEvent) => {
    const { name, ctrl, shift, meta, sequence } = event;

    if (focusMode) {
      if (name === 'escape') {
        onExitFocusModeRef.current();
        return;
      }

      let rawInput = sequence;

      if (name === 'return') {
        rawInput = '\n';
      } else if (name === 'tab') {
        rawInput = '\t';
      } else if (name === 'backspace') {
        rawInput = '\x7f';
      } else if (name === 'delete') {
        rawInput = '\x1b[3~';
      } else if (name === 'up') {
        rawInput = '\x1b[A';
      } else if (name === 'down') {
        rawInput = '\x1b[B';
      } else if (name === 'right') {
        rawInput = '\x1b[C';
      } else if (name === 'left') {
        rawInput = '\x1b[D';
      } else if (ctrl && name.length === 1) {
        const code = name.toUpperCase().charCodeAt(0) - 64;
        if (code >= 1 && code <= 26) {
          rawInput = String.fromCharCode(code);
        }
      }

      if (rawInput) {
        onSendInputRef.current(rawInput);
      }
      return;
    }

    if (quitConfirmPending) {
      if (name === 'q') {
        onQuitRef.current();
      } else {
        onQuitRequestRef.current();
      }
      return;
    }

    if (name === 'q') {
      onQuitRequestRef.current();
      return;
    }

    if (name === 'c' && ctrl) {
      onQuitRef.current();
      return;
    }

    if (name === 'i') {
      onEnterFocusModeRef.current();
      return;
    }

    if (name === 'r') {
      onRestartRef.current(activeIndex);
      return;
    }

    if (name === 'k') {
      onKillRef.current(activeIndex);
      return;
    }

    const num = parseInt(name, 10);
    if (num >= 1 && num <= tabs.length) {
      switchTab(num - 1);
      return;
    }

    if (name === 'tab' && shift) {
      switchTab((activeIndex - 1 + tabs.length) % tabs.length);
      return;
    }
    if (name === 'tab') {
      switchTab((activeIndex + 1) % tabs.length);
      return;
    }

    if (name === 'left' && meta) {
      switchTab((activeIndex - 1 + tabs.length) % tabs.length);
      return;
    }
    if (name === 'right' && meta) {
      switchTab((activeIndex + 1) % tabs.length);
      return;
    }

    // Note: up/down/pageup/pagedown are now handled by the native scrollbox
  });

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
      />
    </box>
  );
}
