import { Terminal } from './components/Terminal';
import { LoadingScreen } from './components/LoadingScreen';
import { UnsupportedBrowser } from './components/UnsupportedBrowser';
import { useWebContainer } from './hooks/useWebContainer';
import { useBrowserSupport } from './hooks/useBrowserSupport';

function Header() {
  const handleReset = () => {
    window.location.reload();
  };

  return (
    <header className="header">
      <span className="wordmark">pok</span>
      <button className="reset-button" onClick={handleReset} title="Restart the environment">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 8a7 7 0 0 1 7-7 7 7 0 0 1 5.5 2.67" />
          <polyline points="14 2 14 6 10 6" />
          <path d="M15 8a7 7 0 0 1-7 7 7 7 0 0 1-5.5-2.67" />
          <polyline points="2 14 2 10 6 10" />
        </svg>
        Reset
      </button>
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
          <div className="error-screen">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="32" cy="32" r="28" />
                <line x1="32" y1="20" x2="32" y2="36" />
                <circle cx="32" cy="44" r="2" fill="currentColor" />
              </svg>
            </div>
            <h1>Failed to load environment</h1>
            <p className="error-message">
              {error?.message || 'An unknown error occurred while starting the terminal environment.'}
            </p>
            <p className="error-hint">
              This could be due to network issues or browser restrictions. Make sure you're using Chrome or Firefox with a stable connection.
            </p>
            <div className="error-actions">
              <button className="retry-button" onClick={() => window.location.reload()}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 8a7 7 0 0 1 7-7 7 7 0 0 1 5.5 2.67" />
                  <polyline points="14 2 14 6 10 6" />
                  <path d="M15 8a7 7 0 0 1-7 7 7 7 0 0 1-5.5-2.67" />
                  <polyline points="2 14 2 10 6 10" />
                </svg>
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
