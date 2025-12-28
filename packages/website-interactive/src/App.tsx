import { useCallback } from 'react';
import { Terminal } from './components/Terminal';
import { LoadingScreen } from './components/LoadingScreen';
import { UnsupportedBrowser } from './components/UnsupportedBrowser';
import { RefreshIcon, AlertIcon } from './components/Icons';
import { useWebContainer } from './hooks/useWebContainer';
import { useBrowserSupport } from './hooks/useBrowserSupport';

function Header() {
  const handleReset = useCallback(() => {
    window.location.reload();
  }, []);

  // Allow keyboard activation (Enter/Space) for accessibility
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleReset();
      }
    },
    [handleReset]
  );

  return (
    <header className="header">
      <div className="header-left">
        <span className="wordmark">pok</span>
        <span className="header-subtitle">interactive tutorial</span>
      </div>
      <div className="header-right">
        <span className="header-hint" aria-hidden="true">
          Use <kbd>↑</kbd>/<kbd>↓</kbd> to navigate menus
        </span>
        <button
          className="reset-button"
          onClick={handleReset}
          onKeyDown={handleKeyDown}
          title="Restart the environment"
          aria-label="Reset environment"
        >
          <RefreshIcon size={14} />
          Reset
        </button>
      </div>
    </header>
  );
}

export function App() {
  const { isSupported, message } = useBrowserSupport();
  const { webContainer, status, error } = useWebContainer();

  if (!isSupported) {
    return <UnsupportedBrowser message={message} />;
  }

  if (status === 'booting' || status === 'installing') {
    return (
      <div className="app">
        <Header />
        <div className="main-content">
          <LoadingScreen status={status} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="app">
        <Header />
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
      <Header />
      <div className="main-content">
        <Terminal webContainer={webContainer} />
      </div>
    </div>
  );
}
