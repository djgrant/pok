/**
 * Tabs App for OpenTUI
 *
 * Wires ProcessManager from core to React state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { spawn, type ChildProcess } from 'node:child_process';
import stripAnsi from 'strip-ansi';
import { TabbedView } from './tabbed-view.js';
import type { TabSpec, TabProcess } from '@openpok/tabs-core';
import type { TabsOptions } from '@openpok/core';
import type { ScrollBoxRenderable } from '@opentui/core';

const OUTPUT_BATCH_MS = 16;
const MAX_OUTPUT_LINES = 10_000;
/** How many pixels from bottom to consider "near bottom" for auto-scroll */
const NEAR_BOTTOM_THRESHOLD = 50;
/** Delay before scrolling to allow React to render new content */
const SCROLL_DELAY_MS = 50;

type TabsAppProps = {
  items: TabSpec[];
  options: TabsOptions;
  onExit: (code: number) => void;
};

type OutputBuffer = {
  lines: string[];
};

function createOutputBuffer(): OutputBuffer {
  return { lines: [] };
}

export function TabsApp({ items, options, onExit }: TabsAppProps) {
  const [tabs, setTabs] = useState<TabProcess[]>(() =>
    items.map((item, i) => ({
      id: `tab-${i}`,
      label: item.label,
      exec: item.exec,
      output: [],
      status: 'running' as const,
    }))
  );
  const [quitConfirmPending, setQuitConfirmPending] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const processesRef = useRef<(ChildProcess | null)[]>([]);
  const outputBuffersRef = useRef<Map<number, OutputBuffer>>(new Map());
  const flushScheduledRef = useRef(false);
  const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null);

  /**
   * Check if the scrollbox is near the bottom.
   * Returns true if within NEAR_BOTTOM_THRESHOLD pixels of bottom, or if content fits in viewport.
   */
  const checkIfNearBottom = useCallback((): boolean => {
    const scroll = scrollBoxRef.current;
    if (!scroll) return true;

    const maxScrollTop = Math.max(
      0,
      scroll.scrollHeight - scroll.viewport.height
    );
    if (maxScrollTop <= 0) return true; // Content fits in viewport

    const distanceFromBottom = maxScrollTop - scroll.scrollTop;
    return distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  /**
   * Scroll to bottom immediately (synchronous). Used for tab switches to avoid visible snap.
   */
  const scrollToBottomImmediate = useCallback(() => {
    const scroll = scrollBoxRef.current;
    if (scroll) {
      scroll.scrollTo(scroll.scrollHeight);
    }
  }, []);

  /**
   * Scroll to bottom with delay. Called after content updates to let React render first.
   */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollToBottomImmediate();
    }, SCROLL_DELAY_MS);
  }, [scrollToBottomImmediate]);

  const handleScrollRef = useCallback(
    (ref: ScrollBoxRenderable | null) => {
      scrollBoxRef.current = ref;
      // Initial scroll to bottom when ref is set - immediate to avoid snap
      if (ref) {
        scrollToBottomImmediate();
      }
    },
    [scrollToBottomImmediate]
  );

  const flushOutput = useCallback(() => {
    flushScheduledRef.current = false;

    const buffersSnapshot = outputBuffersRef.current;
    outputBuffersRef.current = new Map();

    if (buffersSnapshot.size === 0) return;

    const updates: Array<{ index: number; lines: string[] }> = [];
    for (const [index, buffer] of buffersSnapshot.entries()) {
      if (buffer.lines.length > 0) {
        updates.push({ index, lines: buffer.lines });
      }
    }

    if (updates.length === 0) return;

    // Check if near bottom BEFORE updating state (while old content is rendered)
    const wasNearBottom = checkIfNearBottom();

    setTabs((prev) => {
      const next = [...prev];
      for (const { index, lines } of updates) {
        const tab = next[index];
        if (!tab) continue;

        const newOutput = [...tab.output, ...lines];
        const trimmed =
          newOutput.length > MAX_OUTPUT_LINES
            ? newOutput.slice(-MAX_OUTPUT_LINES)
            : newOutput;

        next[index] = { ...tab, output: trimmed };
      }
      return next;
    });

    // If we were near bottom, scroll to bottom after content updates
    if (wasNearBottom) {
      scrollToBottom();
    }
  }, [checkIfNearBottom, scrollToBottom]);

  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    setTimeout(flushOutput, OUTPUT_BATCH_MS);
  }, [flushOutput]);

  const appendOutput = useCallback(
    (index: number, data: Buffer) => {
      const rawText = data.toString('utf-8');
      // Strip ALL ANSI sequences to prevent rendering artifacts
      // We lose colors but gain reliable scrolling
      const text = stripAnsi(rawText)
        // Also convert lone carriage returns to newlines (progress bars)
        .replace(/\r(?!\n)/g, '\n');
      const lines = text.split(/\r?\n/).filter((line, idx, arr) => {
        return line || idx < arr.length - 1;
      });

      if (lines.length === 0) return;

      let buffer = outputBuffersRef.current.get(index);
      if (!buffer) {
        buffer = createOutputBuffer();
        outputBuffersRef.current.set(index, buffer);
      }
      buffer.lines.push(...lines);

      scheduleFlush();
    },
    [scheduleFlush]
  );

  const spawnProcess = useCallback(
    (index: number): ChildProcess | null => {
      const item = items[index];
      if (!item) return null;

      const proc = spawn('sh', ['-c', item.exec], {
        cwd: options.cwd,
        env: {
          ...options.env,
          FORCE_COLOR: '1',
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const handleData = (data: Buffer) => appendOutput(index, data);

      proc.stdout?.on('data', handleData);
      proc.stderr?.on('data', handleData);

      proc.on('close', (code) => {
        flushOutput();
        setTabs((prev) => {
          const next = [...prev];
          const tab = next[index];
          if (!tab) return prev;
          next[index] = {
            ...tab,
            status: code === 0 ? 'done' : 'error',
            exitCode: code ?? undefined,
          };
          return next;
        });
      });

      proc.on('error', (err) => {
        setTabs((prev) => {
          const next = [...prev];
          const tab = next[index];
          if (!tab) return prev;
          next[index] = {
            ...tab,
            status: 'error',
            output: [...tab.output, `Error: ${err.message}`],
          };
          return next;
        });
      });

      return proc;
    },
    [items, options.cwd, options.env, appendOutput, flushOutput]
  );

  useEffect(() => {
    const procs = items.map((_, i) => spawnProcess(i));
    processesRef.current = procs;

    return () => {
      for (const proc of processesRef.current) {
        if (proc && !proc.killed) {
          proc.kill('SIGTERM');
        }
      }
    };
  }, [items, spawnProcess]);

  const killAll = useCallback(() => {
    for (const proc of processesRef.current) {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    }
  }, []);

  const handleRestart = useCallback(
    (index: number) => {
      const existingProc = processesRef.current[index];
      if (existingProc && !existingProc.killed) {
        existingProc.kill('SIGTERM');
      }

      outputBuffersRef.current.delete(index);

      setTabs((prev) => {
        const next = [...prev];
        const tab = next[index];
        if (!tab) return prev;
        next[index] = {
          ...tab,
          output: ['Restarting...', ''],
          status: 'running',
          exitCode: undefined,
        };
        return next;
      });

      // Scroll to bottom after restart since output is cleared
      scrollToBottom();

      setTimeout(() => {
        const newProc = spawnProcess(index);
        processesRef.current[index] = newProc;
      }, 100);
    },
    [spawnProcess, scrollToBottom]
  );

  const handleKill = useCallback((index: number) => {
    const proc = processesRef.current[index];
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }

    setTabs((prev) => {
      const next = [...prev];
      const tab = next[index];
      if (!tab) return prev;
      if (tab.status !== 'running') return prev;
      next[index] = {
        ...tab,
        status: 'stopped',
        output: [...tab.output, '', 'Stopped'],
      };
      return next;
    });
  }, []);

  const handleQuitRequest = useCallback(() => {
    setQuitConfirmPending((prev) => !prev);
  }, []);

  const handleQuit = useCallback(() => {
    killAll();
    onExit(0);
  }, [killAll, onExit]);

  const handleEnterFocusMode = useCallback(() => {
    const proc = processesRef.current[activeIndex];
    if (proc && !proc.killed && proc.stdin) {
      setFocusMode(true);
    }
  }, [activeIndex]);

  const handleExitFocusMode = useCallback(() => {
    setFocusMode(false);
  }, []);

  const handleSendInput = useCallback(
    (data: string) => {
      const proc = processesRef.current[activeIndex];
      if (proc && !proc.killed && proc.stdin) {
        proc.stdin.write(data);
      }
    },
    [activeIndex]
  );

  const handleActiveIndexChange = useCallback(
    (index: number) => {
      setActiveIndex(index);
      setFocusMode(false);
      // Scroll to bottom when switching tabs
      scrollToBottom();
    },
    [scrollToBottom]
  );

  return (
    <TabbedView
      tabs={tabs}
      activeIndex={activeIndex}
      onActiveIndexChange={handleActiveIndexChange}
      onQuit={handleQuit}
      onQuitRequest={handleQuitRequest}
      onRestart={handleRestart}
      onKill={handleKill}
      quitConfirmPending={quitConfirmPending}
      focusMode={focusMode}
      onEnterFocusMode={handleEnterFocusMode}
      onExitFocusMode={handleExitFocusMode}
      onSendInput={handleSendInput}
      scrollRef={handleScrollRef}
    />
  );
}
