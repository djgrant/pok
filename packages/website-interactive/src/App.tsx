import { useState } from 'react';
import { Terminal } from './components/Terminal';
import { Sidebar } from './components/Sidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { UnsupportedBrowser } from './components/UnsupportedBrowser';
import { useWebContainer } from './hooks/useWebContainer';
import { useBrowserSupport } from './hooks/useBrowserSupport';

export function App() {
  const { isSupported, message } = useBrowserSupport();
  const { webContainer, status, error } = useWebContainer();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);

  if (!isSupported) {
    return <UnsupportedBrowser message={message} />;
  }

  if (status === 'booting' || status === 'installing') {
    return <LoadingScreen status={status} />;
  }

  if (status === 'error') {
    return (
      <div className="error-screen">
        <h1>Failed to load environment</h1>
        <p>{error?.message || 'An unknown error occurred'}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        selectedLesson={selectedLesson}
        onSelectLesson={setSelectedLesson}
      />
      <main className="main-content">
        <Terminal webContainer={webContainer} />
      </main>
    </div>
  );
}
