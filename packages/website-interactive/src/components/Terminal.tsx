import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebContainer } from '@webcontainer/api';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  webContainer: WebContainer | null;
}

export function Terminal({ webContainer }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
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
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln('Starting pok...');
    terminal.writeln('');

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
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

    const setupShell = async () => {
      const terminal = xtermRef.current!;

      // Start a shell process
      shellProcess = await webContainer.spawn('jsh', {
        terminal: {
          cols: terminal.cols,
          rows: terminal.rows,
        },
      });

      // Pipe shell output to terminal
      shellProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            terminal.write(data);
          },
        })
      );

      // Get input writer
      shellWriter = shellProcess.input.getWriter();

      // Handle terminal input
      terminal.onData((data) => {
        shellWriter?.write(data);
      });

      // Handle terminal resize
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

      // Auto-run 'pok learn' after shell is ready
      // Small delay to ensure shell is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 100));
      await shellWriter.write('pok learn\n');
    };

    setupShell().catch((err) => {
      console.error('Failed to setup shell:', err);
      xtermRef.current?.writeln(`\r\n\x1b[31mError: Failed to start shell: ${err.message}\x1b[0m`);
    });

    return () => {
      shellWriter?.close();
      shellProcess?.kill();
    };
  }, [webContainer]);

  return (
    <div className="terminal-container">
      <div ref={terminalRef} className="terminal-element" />
    </div>
  );
}
