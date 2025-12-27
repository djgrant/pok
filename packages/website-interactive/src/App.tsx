import { useState, useMemo, useRef, useCallback } from 'react';
import { Terminal, TerminalHandle } from './components/Terminal';
import { Sidebar } from './components/Sidebar';
import { LessonContent } from './components/LessonContent';
import { LoadingScreen } from './components/LoadingScreen';
import { UnsupportedBrowser } from './components/UnsupportedBrowser';
import { useWebContainer } from './hooks/useWebContainer';
import { useBrowserSupport } from './hooks/useBrowserSupport';
import { useCompletedLessons } from './hooks/useCompletedLessons';
import { loadLessons, findLessonById, getAdjacentLessons, getAllLessonsFlat } from './lib/lessons';

// Import all lesson markdown files at build time
const lessonModules = import.meta.glob('../lessons/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export function App() {
  const { isSupported, message } = useBrowserSupport();
  const { webContainer, status, error } = useWebContainer();
  const { isComplete, toggleComplete } = useCompletedLessons();
  const terminalRef = useRef<TerminalHandle>(null);

  // Callback to run commands in terminal
  const runCommand = useCallback((command: string) => {
    terminalRef.current?.writeCommand(command);
  }, []);

  // Load and parse lessons
  const categories = useMemo(() => loadLessons(lessonModules), []);
  const allLessons = useMemo(() => getAllLessonsFlat(categories), [categories]);

  // Default to first lesson
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    () => allLessons[0]?.id ?? null
  );

  const selectedLesson = useMemo(
    () => (selectedLessonId ? findLessonById(categories, selectedLessonId) : null),
    [categories, selectedLessonId]
  );

  const adjacentLessons = useMemo(
    () =>
      selectedLessonId
        ? getAdjacentLessons(categories, selectedLessonId)
        : { prev: null, next: null },
    [categories, selectedLessonId]
  );

  if (!isSupported) {
    return <UnsupportedBrowser message={message} />;
  }

  if (status === 'booting' || status === 'installing') {
    return <LoadingScreen status={status} />;
  }

  if (status === 'error') {
    return (
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
    );
  }

  return (
    <div className="app">
      <Sidebar
        categories={categories}
        selectedLesson={selectedLessonId}
        onSelectLesson={setSelectedLessonId}
        isComplete={isComplete}
      />
      <main className="main-content">
        <div className="content-area">
          {selectedLesson ? (
            <LessonContent
              lesson={selectedLesson}
              isComplete={isComplete(selectedLesson.id)}
              onMarkComplete={() => toggleComplete(selectedLesson.id)}
              onPrevious={
                adjacentLessons.prev ? () => setSelectedLessonId(adjacentLessons.prev!.id) : null
              }
              onNext={
                adjacentLessons.next ? () => setSelectedLessonId(adjacentLessons.next!.id) : null
              }
              prevTitle={adjacentLessons.prev?.title ?? null}
              nextTitle={adjacentLessons.next?.title ?? null}
              onRunCommand={runCommand}
              webContainer={webContainer}
            />
          ) : (
            <div className="no-lesson-selected">
              <p>Select a lesson from the sidebar to get started.</p>
            </div>
          )}
        </div>
        <div className="terminal-area">
          <Terminal ref={terminalRef} webContainer={webContainer} />
        </div>
      </main>
    </div>
  );
}
