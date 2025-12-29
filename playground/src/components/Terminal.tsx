import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebContainer } from '@webcontainer/api';
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
  /** Command to auto-run when shell is ready */
  command?: string;
  /** Delay in ms before running command (useful for coordinating startup) */
  startDelay?: number;
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

export function Terminal({ webContainer, command, startDelay = 0 }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Focus terminal when user clicks on it
  const handleContainerClick = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

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

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Connect terminal to WebContainer shell
  useEffect(() => {
    if (!webContainer || !xtermRef.current) return;

    let shellProcess: Awaited<ReturnType<typeof webContainer.spawn>> | null = null;
    let shellWriter: WritableStreamDefaultWriter<string> | null = null;
    let outputStreamController: AbortController | null = null;
    let isCleaningUp = false;

    const setupShell = async () => {
      const terminal = xtermRef.current!;

      // Start a shell process
      shellProcess = await webContainer.spawn('jsh', {
        terminal: {
          cols: terminal.cols,
          rows: terminal.rows,
        },
      });

      // Use AbortController to properly cancel the output stream on cleanup
      outputStreamController = new AbortController();

      // Pipe shell output to terminal with abort signal
      shellProcess.output
        .pipeTo(
          new WritableStream({
            write(data) {
              terminal.write(data);
            },
          }),
          { signal: outputStreamController.signal }
        )
        .catch((err) => {
          // Ignore abort errors during cleanup
          if (!isCleaningUp && err.name !== 'AbortError') {
            console.error('Output stream error:', err);
          }
        });

      // Get input writer
      shellWriter = shellProcess.input.getWriter();

      // Handle terminal input
      terminal.onData((data) => {
        shellWriter?.write(data);
      });

      // Handle terminal resize with debouncing handled by the shell
      terminal.onResize(({ cols, rows }) => {
        shellProcess?.resize({ cols, rows });
      });

      // Initial resize
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        shellProcess.resize({
          cols: terminal.cols,
          rows: terminal.rows,
        });
      }

      // Auto-run command after shell is ready
      // Small delay to ensure shell is fully initialized, plus any startDelay for coordination
      await new Promise((resolve) => setTimeout(resolve, 100 + startDelay));
      if (command) {
        await shellWriter.write(`${command}\n`);
      }
    };

    setupShell().catch((err) => {
      console.error('Failed to setup shell:', err);
      xtermRef.current?.writeln(`\r\n\x1b[31mError: Failed to start shell: ${err.message}\x1b[0m`);
    });

    return () => {
      isCleaningUp = true;
      // Abort the output stream first to prevent errors during cleanup
      outputStreamController?.abort();
      shellWriter?.close();
      shellProcess?.kill();
    };
  }, [webContainer, command, startDelay]);

  return (
    <div className="terminal-container" onClick={handleContainerClick}>
      <div ref={terminalRef} className="terminal-element" />
    </div>
  );
}
