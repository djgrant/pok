/**
 * Event-Driven CLI App
 *
 * A React component that renders CLI state based on EventBus events.
 * Supports different layouts (tabs, parallel, sequence) based on group layout hints.
 */

import { useState, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { EventBus } from '@pokit/core';
import type { ActivityNode } from '@pokit/tabs-core';
import { findTabsGroup, getTabsGroupActivities } from '@pokit/tabs-core';
import { useEventBus } from './use-event-bus.js';

type EventDrivenAppProps = {
  bus: EventBus;
  onExit: (code: number) => void;
};

function getStatusIndicator({
  status,
  inverse,
}: {
  status: ActivityNode['status'];
  inverse?: boolean;
}) {
  switch (status) {
    case 'running':
      return { color: inverse ? 'cyanBright' : 'cyan', icon: '●' };
    case 'success':
      return { color: inverse ? 'greenBright' : 'green', icon: '✓' };
    case 'failure':
      return { color: inverse ? 'redBright' : 'red', icon: '✗' };
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
    <Box gap={1} flexWrap="wrap">
      {activities.map((activity, i) => {
        const isActive = i === activeIndex;
        const { color, icon } = getStatusIndicator({
          status: activity.status,
          inverse: isActive,
        });
        return (
          <Box key={activity.id}>
            <Text inverse={isActive} color={color}>
              {' '}
              {icon}{' '}
            </Text>
            <Text inverse={isActive}> {activity.label}</Text>
            <Text inverse={isActive}>
              {' ('}
              {i + 1}
              {') '}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

function ActivityView({ activity, viewHeight }: { activity: ActivityNode; viewHeight: number }) {
  const logs = activity.logs.slice(-viewHeight);

  return (
    <Box flexDirection="column" height={viewHeight} overflow="hidden">
      {activity.message && <Text color="cyan">{activity.message}</Text>}
      {activity.progress !== undefined && (
        <Text color="yellow">Progress: {activity.progress}%</Text>
      )}
      {logs.map((log, i) => {
        let color: string | undefined;
        switch (log.level) {
          case 'error':
            color = 'red';
            break;
          case 'warn':
            color = 'yellow';
            break;
          case 'success':
            color = 'green';
            break;
          case 'info':
            color = 'blue';
            break;
          default:
            color = undefined;
        }
        return (
          <Text key={i} color={color} wrap="truncate">
            {log.message}
          </Text>
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
        <Text key={`empty-${i}`}> </Text>
      ))}
    </Box>
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
      <Box>
        <Text backgroundColor="yellow" color="black">
          {' '}
          Press q again to quit, any other key to cancel{' '}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text dimColor>[Tab/1-{activityCount}] switch | [q]uit</Text>
    </Box>
  );
}

export function EventDrivenApp({ bus, onExit }: EventDrivenAppProps) {
  const state = useEventBus(bus);
  const { stdout } = useStdout();
  const [activeIndex, setActiveIndex] = useState(0);
  const [quitConfirmPending, setQuitConfirmPending] = useState(false);

  const terminalHeight = stdout?.rows ?? 24;
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

  useInput(
    (input, key) => {
      if (quitConfirmPending) {
        if (input === 'q') {
          handleQuit();
        } else {
          handleQuitRequest();
        }
        return;
      }

      if (input === 'q') {
        handleQuitRequest();
        return;
      }

      if (input === 'c' && key.ctrl) {
        handleQuit();
        return;
      }

      const num = parseInt(input, 10);
      if (num >= 1 && num <= activities.length) {
        switchTab(num - 1);
        return;
      }

      if (key.tab && key.shift) {
        switchTab((activeIndex - 1 + activities.length) % activities.length);
        return;
      }
      if (key.tab) {
        switchTab((activeIndex + 1) % activities.length);
        return;
      }
    },
    { isActive: true }
  );

  if (activities.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Waiting for activities...</Text>
        {state.appName && (
          <Text dimColor>
            {state.appName}
            {state.version ? ` v${state.version}` : ''}
          </Text>
        )}
      </Box>
    );
  }

  if (!activeActivity) {
    return <Text>No active activity</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <ActivityTabBar activities={activities} activeIndex={activeIndex} />
      <Box
        borderLeft={false}
        borderRight={false}
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        <ActivityView activity={activeActivity} viewHeight={viewHeight} />
      </Box>
      <StatusBar activityCount={activities.length} quitConfirmPending={quitConfirmPending} />
    </Box>
  );
}
