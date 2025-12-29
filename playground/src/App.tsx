import { Terminal } from './components/Terminal';
import { LoadingScreen } from './components/LoadingScreen';
import { UnsupportedBrowser } from './components/UnsupportedBrowser';
import { RefreshIcon, AlertIcon } from './components/Icons';
import { useWebContainer } from './hooks/useWebContainer';
import { useBrowserSupport } from './hooks/useBrowserSupport';

export function App() {
  const { isSupported, message } = useBrowserSupport();
  const { webContainer, status, error } = useWebContainer();

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
        <div className="terminal-pane">
          <Terminal webContainer={webContainer} command="pok learn" />
        </div>
        <div className="terminal-pane">
          <Terminal webContainer={webContainer} command="pok introspect" startDelay={200} />
        </div>
      </div>
    </div>
  );
}
