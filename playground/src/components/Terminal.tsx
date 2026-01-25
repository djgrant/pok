import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, memo } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { UseEventBusResult } from '../hooks/useEventBus';
import '@xterm/xterm/css/xterm.css';

// Tokyo Night theme for xterm - matches the app's color scheme
const TERMINAL_THEME = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#33467c',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
} as const;

interface TerminalProps {
  webContainer: WebContainer | null;
  /** Unique ID for this terminal (used for stable identity) */
  tabId: string;
  /** Command to auto-run when shell is ready */
  command?: string;
  /** Delay in ms before running command (useful for coordinating startup) */
  startDelay?: number;
  /** Whether this terminal is currently focused */
  isFocused?: boolean;
  /** Event bus for emitting file events */
  eventBus?: UseEventBusResult;
  /** Whether this is a task (one-shot command) vs interactive shell */
  isTask?: boolean;
  /** Callback when terminal title changes */
  onTitleChange?: (title: string) => void;
  /** Callback when task completes (exit code) */
  onTaskComplete?: (exitCode: number) => void;
}

export interface TerminalHandle {
  /** Focus the terminal */
  focus: () => void;
  /** Clear the terminal screen */
  clear: () => void;
}

/**
 * Debounce a function call to avoid excessive invocations.
 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Regex to match pok file event markers in terminal output.
 * Format: \x1b]pok:file:<type>:<path>\x07
 *
 * Uses OSC (Operating System Command) escape sequence:
 * - \x1b] starts OSC
 * - \x07 (BEL) ends OSC
 */
const FILE_EVENT_REGEX = /\x1b\]pok:file:(created|updated|deleted):([^\x07]+)\x07/g;

/**
 * Regex to match xterm title escape sequences.
 * Format: \x1b]0;title\x07 or \x1b]2;title\x07
 * Also matches optional trailing newline (from console.log in WebContainer)
 * Note: Not using global flag to avoid state issues with .exec()
 */
const TITLE_REGEX = /\x1b\][02];([^\x07]*)\x07\n?/;

/**
 * Process terminal output data to extract and emit file events.
 * Returns the data with file event markers stripped out.
 */
function processFileEvents(data: string, eventBus: UseEventBusResult | undefined): string {
  if (!eventBus) return data;

  // Reset regex state before using (global regex maintains lastIndex)
  FILE_EVENT_REGEX.lastIndex = 0;

  let match;
  while ((match = FILE_EVENT_REGEX.exec(data)) !== null) {
    const [, type, path] = match;
    const eventType = `file:${type}` as 'file:created' | 'file:updated' | 'file:deleted';
    eventBus.emit({ type: eventType, path });
  }

  // Strip the markers from the output so they don't show in terminal
  // Reset again for .replace() to work correctly
  FILE_EVENT_REGEX.lastIndex = 0;
  return data.replace(FILE_EVENT_REGEX, '');
}

/**
 * Extract title from terminal output.
 */
function extractTitle(data: string): string | null {
  const match = TITLE_REGEX.exec(data);
  if (match) {
    return match[1];
  }
  return null;
}

const TerminalInner = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  {
    webContainer,
    tabId,
    command,
    startDelay = 0,
    isFocused = false,
    eventBus,
    isTask = false,
    onTitleChange,
    onTaskComplete,
  },
  ref
) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellProcessRef = useRef<WebContainerProcess | null>(null);
  const isCompletedRef = useRef(false);
  // Synchronous flag to prevent race conditions in StrictMode double-mount
  const processStartingRef = useRef(false);
  // Store process writer for event bus commands
  const processWriterRef = useRef<WritableStreamDefaultWriter<string> | null>(null);

  // Suppress unused variable warning - tabId is used for memoization identity
  void tabId;

  // Expose focus and clear methods to parent
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        xtermRef.current?.focus();
      },
      clear: () => {
        xtermRef.current?.clear();
      },
    }),
    []
  );

  // Focus terminal when user clicks on it
  const handleContainerClick = useCallback(() => {
    if (!isCompletedRef.current) {
      xtermRef.current?.focus();
    }
  }, []);

  // Initialize xterm - only run once per terminal instance
  // Guard against StrictMode double-mount by checking if xterm already exists
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: TERMINAL_THEME,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Auto-focus terminal for immediate keyboard input
    terminal.focus();

    // Debounce resize to avoid excessive reflows
    const handleResize = debounce(() => {
      fitAddon.fit();
    }, 100);

    window.addEventListener('resize', handleResize);

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    // NOTE: We do NOT dispose the terminal on cleanup because StrictMode
    // will unmount/remount and we want to preserve the terminal state.
    // The terminal will be cleaned up when the page unloads.
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      // Don't dispose terminal - let it persist across StrictMode remounts
    };
  }, []);

  // Connect terminal to WebContainer
  // Guard against StrictMode double-mount by checking if process already exists
  useEffect(() => {
    if (!webContainer || !xtermRef.current) return;

    // Skip if process already running or setup already started
    if (shellProcessRef.current || processStartingRef.current) return;

    // Set flag immediately (synchronously) to prevent race conditions
    processStartingRef.current = true;

    const terminal = xtermRef.current;
    let process: WebContainerProcess | null = null;
    let processWriter: WritableStreamDefaultWriter<string> | null = null;
    let outputStreamController: AbortController | null = null;

    const setupProcess = async () => {
      // Double-check process hasn't been started by another effect run
      if (shellProcessRef.current) return;

      // For tasks, run the command directly without a shell
      // For interactive shells, spawn jsh
      if (isTask && command) {
        // Parse command into program and args
        const parts = command.split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);

        // Wait for any start delay
        if (startDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, startDelay));
        }

        process = await webContainer.spawn(program, args, {
          terminal: {
            cols: terminal.cols,
            rows: terminal.rows,
          },
        });
      } else {
        // Start a shell process for interactive use
        process = await webContainer.spawn('jsh', {
          terminal: {
            cols: terminal.cols,
            rows: terminal.rows,
          },
        });
      }

      // Store process reference immediately to prevent duplicate spawns
      shellProcessRef.current = process;

      // Use AbortController to properly cancel the output stream on cleanup
      outputStreamController = new AbortController();

      // Pipe process output to terminal with abort signal
      // Also intercept file events from the learn command
      process.output
        .pipeTo(
          new WritableStream({
            write(data) {
              // Process file events and strip markers from output
              let cleanedData = processFileEvents(data, eventBus);

              // Extract title if present and strip from output
              const title = extractTitle(cleanedData);
              if (title && onTitleChange) {
                onTitleChange(title);
                // Strip title escape sequence from output (xterm handles it, but let's be safe)
                cleanedData = cleanedData.replace(TITLE_REGEX, '');
              }

              terminal.write(cleanedData);
            },
          }),
          { signal: outputStreamController.signal }
        )
        .catch((err) => {
          // Ignore abort errors during cleanup
          if (err.name !== 'AbortError') {
            console.error('Output stream error:', err);
          }
        });

      // Get input writer
      processWriter = process.input.getWriter();
      processWriterRef.current = processWriter;

      // Handle terminal input - but not if task is completed
      terminal.onData((data) => {
        if (!isCompletedRef.current) {
          processWriter?.write(data);
        }
      });

      // Handle terminal resize
      terminal.onResize(({ cols, rows }) => {
        process?.resize({ cols, rows });
      });

      // Initial resize
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        process.resize({
          cols: terminal.cols,
          rows: terminal.rows,
        });
      }

      // For non-task shells with a command, auto-run after shell is ready
      if (!isTask && command) {
        await new Promise((resolve) => setTimeout(resolve, 100 + startDelay));
        await processWriter.write(`${command}\n`);
      }

      // For tasks, watch for process exit to disable input
      if (isTask && process) {
        process.exit.then((exitCode) => {
          isCompletedRef.current = true;
          // Disable cursor and show completion message
          terminal.options.cursorBlink = false;
          terminal.options.cursorStyle = 'bar';
          terminal.options.cursorInactiveStyle = 'none';
          // Write a completion message
          terminal.writeln('');
          terminal.writeln(
            exitCode === 0
              ? '\x1b[32m✓ Task completed\x1b[0m'
              : `\x1b[31m✗ Task failed (exit code: ${exitCode})\x1b[0m`
          );
          if (onTaskComplete) {
            onTaskComplete(exitCode);
          }
        });
      }
    };

    setupProcess().catch((err) => {
      console.error('Failed to setup process:', err);
      xtermRef.current?.writeln(
        `\r\n\x1b[31mError: Failed to start process: ${err instanceof Error ? err.message : String(err)}\x1b[0m`
      );
    });

    // NOTE: We do NOT clean up the process on unmount because StrictMode
    // will unmount/remount and we want to preserve the terminal session.
    // The process will be cleaned up when the page unloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webContainer]);

  // Listen for terminal:run events (only for non-task terminals)
  useEffect(() => {
    if (!eventBus || isTask) return;

    const unsubscribe = eventBus.subscribe('terminal:run', (event) => {
      if (event.type === 'terminal:run' && processWriterRef.current) {
        processWriterRef.current.write(`${event.command}\n`);
      }
    });

    return unsubscribe;
  }, [eventBus, isTask]);

  return (
    <div
      className={`terminal-container ${isFocused ? 'terminal-focused' : ''} ${isCompletedRef.current ? 'terminal-completed' : ''}`}
      onClick={handleContainerClick}
    >
      <div ref={terminalRef} className="terminal-element" />
    </div>
  );
});

// Memoize to prevent re-renders when parent state changes
// Only re-render if tabId changes (which would mean a different terminal)
export const Terminal = memo(TerminalInner, (prevProps, nextProps) => {
  // Only re-render if these key props change
  return prevProps.tabId === nextProps.tabId && prevProps.webContainer === nextProps.webContainer;
});
