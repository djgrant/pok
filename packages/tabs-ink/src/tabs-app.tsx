import { useState, useEffect, useCallback, useRef } from 'react';
import { spawn, type ChildProcess } from 'node:child_process';
import { TabbedView } from './tabbed-view.js';
import { MAX_OUTPUT_LINES } from '@openpok/tabs-core';
import type { TabProcess } from './types.js';
import type { TabSpec, TabsOptions } from '@openpok/core';

const OUTPUT_BATCH_MS = 16;

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
  const [helpVisible, setHelpVisible] = useState(false);
  const processesRef = useRef<(ChildProcess | null)[]>([]);
  const outputBuffersRef = useRef<Map<number, OutputBuffer>>(new Map());
  const flushScheduledRef = useRef(false);

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

    setTabs((prev) => {
      const next = [...prev];
      for (const { index, lines } of updates) {
        const tab = next[index];
        if (!tab) continue;

        const newOutput = [...tab.output, ...lines];
        const trimmed =
          newOutput.length > MAX_OUTPUT_LINES ? newOutput.slice(-MAX_OUTPUT_LINES) : newOutput;

        next[index] = { ...tab, output: trimmed };
      }
      return next;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    setTimeout(flushOutput, OUTPUT_BATCH_MS);
  }, [flushOutput]);

  const appendOutput = useCallback(
    (index: number, data: Buffer) => {
      const text = data.toString('utf-8');
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

      // Use 'pipe' for stdin so we can send input in focus mode
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

      setTimeout(() => {
        const newProc = spawnProcess(index);
        processesRef.current[index] = newProc;
      }, 100);
    },
    [spawnProcess]
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

  const handleActiveIndexChange = useCallback((index: number) => {
    setActiveIndex(index);
    // Exit focus mode when switching tabs
    setFocusMode(false);
  }, []);

  const handleToggleHelp = useCallback(() => {
    setHelpVisible((prev) => !prev);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setHelpVisible(false);
  }, []);

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
      helpVisible={helpVisible}
      onToggleHelp={handleToggleHelp}
      onCloseHelp={handleCloseHelp}
    />
  );
}
