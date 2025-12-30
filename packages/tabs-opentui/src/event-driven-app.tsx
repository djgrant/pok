/**
 * Event-Driven CLI App for OpenTUI
 *
 * A React component that renders CLI state based on EventBus events.
 * Supports different layouts (tabs, parallel, sequence) based on group layout hints.
 */

import { useState, useCallback } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { KeyEvent } from '@opentui/core';
import type { EventBus } from '@pokjs/core';
import type { ActivityNode } from '@pokjs/tabs-core';
import { findTabsGroup, getTabsGroupActivities } from '@pokjs/tabs-core';
import { useEventBus } from './use-event-bus.js';

type EventDrivenAppProps = {
  bus: EventBus;
  onExit: (code: number) => void;
};

function getStatusIndicator({
  status,
  isActive,
}: {
  status: ActivityNode['status'];
  isActive?: boolean;
}) {
  switch (status) {
    case 'running':
      return { color: isActive ? '#00FFFF' : '#008B8B', icon: '\u25CF' };
    case 'success':
      return { color: isActive ? '#00FF00' : '#008000', icon: '\u2713' };
    case 'failure':
      return { color: isActive ? '#FF0000' : '#8B0000', icon: '\u2717' };
  }
}

function ActivityTabBar({
  activities,
  activeIndex,
}: {
  activities: ActivityNode[];
  activeIndex: number;
}) {
  return (
    <box flexDirection="row" gap={1} flexWrap="wrap">
      {activities.map((activity, i) => {
        const isActive = i === activeIndex;
        const { color, icon } = getStatusIndicator({
          status: activity.status,
          isActive,
        });
        return (
          <box key={activity.id} flexDirection="row">
            <text fg={color}> {icon} </text>
            <box style={isActive ? { backgroundColor: '#444' } : {}}>
              <text fg={isActive ? '#FFF' : '#888'}>
                {' '}
                {activity.label} ({i + 1}){' '}
              </text>
            </box>
          </box>
        );
      })}
    </box>
  );
}

function ActivityView({ activity, viewHeight }: { activity: ActivityNode; viewHeight: number }) {
  const logs = activity.logs.slice(-viewHeight);

  return (
    <box flexDirection="column" height={viewHeight} overflow="hidden">
      {activity.message && <text fg="#00FFFF">{activity.message}</text>}
      {activity.progress !== undefined && <text fg="#FFFF00">Progress: {activity.progress}%</text>}
      {logs.map((log, i) => {
        let color: string | undefined;
        switch (log.level) {
          case 'error':
            color = '#FF0000';
            break;
          case 'warn':
            color = '#FFFF00';
            break;
          case 'success':
            color = '#00FF00';
            break;
          case 'info':
            color = '#0000FF';
            break;
          default:
            color = undefined;
        }
        return (
          <text key={i} fg={color}>
            {log.message}
          </text>
        );
      })}
      {Array.from({
        length: Math.max(
          0,
          viewHeight -
            logs.length -
            (activity.message ? 1 : 0) -
            (activity.progress !== undefined ? 1 : 0)
        ),
      }).map((_, i) => (
        <text key={`empty-${i}`}> </text>
      ))}
    </box>
  );
}

function StatusBar({
  activityCount,
  quitConfirmPending,
}: {
  activityCount: number;
  quitConfirmPending: boolean;
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

  return (
    <box>
      <text fg="#666666">[Tab/1-{activityCount}] switch | [q]uit</text>
    </box>
  );
}

export function EventDrivenApp({ bus, onExit }: EventDrivenAppProps) {
  const state = useEventBus(bus);
  const { height: rows } = useTerminalDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [quitConfirmPending, setQuitConfirmPending] = useState(false);

  const terminalHeight = rows ?? 24;
  const viewHeight = Math.max(5, terminalHeight - 6);

  const tabsGroup = findTabsGroup(state);
  const activities = tabsGroup
    ? getTabsGroupActivities(state, tabsGroup.id)
    : Array.from(state.activities.values());

  const activeActivity = activities[activeIndex];

  const switchTab = useCallback(
    (newIndex: number) => {
      if (newIndex >= 0 && newIndex < activities.length) {
        setActiveIndex(newIndex);
      }
    },
    [activities.length]
  );

  const handleQuitRequest = useCallback(() => {
    setQuitConfirmPending((prev) => !prev);
  }, []);

  const handleQuit = useCallback(() => {
    onExit(state.exitCode ?? 0);
  }, [onExit, state.exitCode]);

  useKeyboard((event: KeyEvent) => {
    const { name, ctrl, shift } = event;

    if (quitConfirmPending) {
      if (name === 'q') {
        handleQuit();
      } else {
        handleQuitRequest();
      }
      return;
    }

    if (name === 'q') {
      handleQuitRequest();
      return;
    }

    if (name === 'c' && ctrl) {
      handleQuit();
      return;
    }

    const num = parseInt(name, 10);
    if (num >= 1 && num <= activities.length) {
      switchTab(num - 1);
      return;
    }

    if (name === 'tab' && shift) {
      switchTab((activeIndex - 1 + activities.length) % activities.length);
      return;
    }
    if (name === 'tab') {
      switchTab((activeIndex + 1) % activities.length);
      return;
    }
  });

  if (activities.length === 0) {
    return (
      <box flexDirection="column" padding={1}>
        <text>Waiting for activities...</text>
        {state.appName && (
          <text fg="#666666">
            {state.appName}
            {state.version ? ` v${state.version}` : ''}
          </text>
        )}
      </box>
    );
  }

  if (!activeActivity) {
    return <text>No active activity</text>;
  }

  return (
    <box flexDirection="column" padding={1}>
      <ActivityTabBar activities={activities} activeIndex={activeIndex} />
      <box border={['top', 'bottom']} borderStyle="single" borderColor="#666666">
        <ActivityView activity={activeActivity} viewHeight={viewHeight} />
      </box>
      <StatusBar activityCount={activities.length} quitConfirmPending={quitConfirmPending} />
    </box>
  );
}
