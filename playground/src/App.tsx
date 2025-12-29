import { useRef, useState, useEffect, useCallback } from 'react';
import { Terminal, TerminalHandle } from './components/Terminal';
import { LoadingScreen } from './components/LoadingScreen';
import { UnsupportedBrowser } from './components/UnsupportedBrowser';
import { RefreshIcon, AlertIcon } from './components/Icons';
import { useWebContainer } from './hooks/useWebContainer';
import { useBrowserSupport } from './hooks/useBrowserSupport';

type FocusedPanel = 'left' | 'right';

export function App() {
  const { isSupported, message } = useBrowserSupport();
  const { webContainer, status, error } = useWebContainer();

  const leftTerminalRef = useRef<TerminalHandle>(null);
  const rightTerminalRef = useRef<TerminalHandle>(null);
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>('left');

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === '1') {
        e.preventDefault();
        setFocusedPanel('left');
        leftTerminalRef.current?.focus();
      } else if (isMod && e.key === '2') {
        e.preventDefault();
        setFocusedPanel('right');
        rightTerminalRef.current?.focus();
      } else if (isMod && e.key === 'k') {
        e.preventDefault();
        if (focusedPanel === 'left') {
          leftTerminalRef.current?.clear();
        } else {
          rightTerminalRef.current?.clear();
        }
      }
    },
    [focusedPanel]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Track which panel is focused when user clicks
  const handlePanelFocus = useCallback((panel: FocusedPanel) => {
    setFocusedPanel(panel);
  }, []);

  if (!isSupported) {
    return <UnsupportedBrowser message={message} />;
  }

  if (status === 'booting' || status === 'installing') {
    return (
      <div className="app">
        <div className="main-content">
          <LoadingScreen status={status} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="app">
        <div className="main-content">
          <div className="error-screen" role="alert">
            <div className="error-icon">
              <AlertIcon size={64} />
            </div>
            <h1>Failed to load environment</h1>
            <p className="error-message">
              {error?.message ||
                'An unknown error occurred while starting the terminal environment.'}
            </p>
            <p className="error-hint">
              This could be due to network issues or browser restrictions. Make sure you're using
              Chrome or Firefox with a stable connection.
            </p>
            <div className="error-actions">
              <button
                className="retry-button"
                onClick={() => window.location.reload()}
                aria-label="Retry loading environment"
              >
                <RefreshIcon size={16} />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="terminals-container">
        <div
          className={`terminal-pane ${focusedPanel === 'left' ? 'terminal-pane-active' : ''}`}
          onClick={() => handlePanelFocus('left')}
        >
          <div className="terminal-title">
            <span className="terminal-title-text">pok learn</span>
            <span className="terminal-title-shortcut">
              <kbd>Cmd</kbd>+<kbd>1</kbd>
            </span>
          </div>
          <Terminal
            ref={leftTerminalRef}
            webContainer={webContainer}
            command="pok learn"
            isFocused={focusedPanel === 'left'}
          />
        </div>
        <div
          className={`terminal-pane ${focusedPanel === 'right' ? 'terminal-pane-active' : ''}`}
          onClick={() => handlePanelFocus('right')}
        >
          <div className="terminal-title">
            <span className="terminal-title-text">pok introspect</span>
            <span className="terminal-title-shortcut">
              <kbd>Cmd</kbd>+<kbd>2</kbd>
            </span>
          </div>
          <Terminal
            ref={rightTerminalRef}
            webContainer={webContainer}
            command="pok introspect"
            startDelay={200}
            isFocused={focusedPanel === 'right'}
          />
        </div>
      </div>
      <div className="shortcuts-bar">
        <span className="shortcut-hint">
          <kbd>Cmd</kbd>+<kbd>1</kbd>/<kbd>2</kbd> Switch panels
        </span>
        <span className="shortcut-hint">
          <kbd>Cmd</kbd>+<kbd>K</kbd> Clear terminal
        </span>
      </div>
    </div>
  );
}
