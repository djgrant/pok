import { useRef, useEffect, memo, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Tab } from '../hooks/useWorkspace';
import { UseEventBusResult } from '../hooks/useEventBus';
import { Terminal, TerminalHandle } from './Terminal';
import { FileViewer } from './FileViewer';

interface TabContentProps {
  tab: Tab;
  webContainer: WebContainer | null;
  isActive: boolean;
  eventBus?: UseEventBusResult;
  /** Callback to register the terminal ref for external control (e.g., clearing) */
  onTerminalRef?: (handle: TerminalHandle | null) => void;
  /** Callback when terminal title changes */
  onTitleChange?: (tabId: string, title: string) => void;
  /** Callback when task completes */
  onTaskComplete?: (tabId: string, exitCode: number) => void;
}

function TabContentInner({
  tab,
  webContainer,
  isActive,
  eventBus,
  onTerminalRef,
  onTitleChange,
  onTaskComplete,
}: TabContentProps) {
  const terminalRef = useRef<TerminalHandle>(null);

  // Report terminal ref to parent for keyboard shortcuts (Cmd+K to clear)
  useEffect(() => {
    if (tab.type === 'terminal' && terminalRef.current) {
      onTerminalRef?.(terminalRef.current);
    }
    return () => {
      if (tab.type === 'terminal') {
        onTerminalRef?.(null);
      }
    };
  }, [tab.type, onTerminalRef]);

  // Focus terminal when tab becomes active
  useEffect(() => {
    if (isActive && tab.type === 'terminal') {
      // Small delay to ensure terminal is mounted
      const timer = setTimeout(() => {
        terminalRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, tab.type]);

  // Callbacks that include tabId
  const handleTitleChange = useCallback((title: string) => {
    onTitleChange?.(tab.id, title);
  }, [tab.id, onTitleChange]);

  const handleTaskComplete = useCallback((exitCode: number) => {
    onTaskComplete?.(tab.id, exitCode);
  }, [tab.id, onTaskComplete]);

  if (tab.type === 'terminal') {
    // Determine if this is a task (has a command) vs interactive shell
    const isTask = Boolean(tab.command);
    
    return (
      <div className={`tab-content ${isActive ? 'tab-content-active' : 'tab-content-hidden'}`}>
        <Terminal
          ref={terminalRef}
          tabId={tab.id}
          webContainer={webContainer}
          command={tab.command}
          isFocused={isActive}
          eventBus={eventBus}
          isTask={isTask}
          onTitleChange={handleTitleChange}
          onTaskComplete={handleTaskComplete}
        />
      </div>
    );
  }

  // File viewer
  if (tab.type === 'file' && tab.filePath && webContainer) {
    return (
      <div className={`tab-content ${isActive ? 'tab-content-active' : 'tab-content-hidden'}`}>
        <FileViewer
          filePath={tab.filePath}
          webcontainer={webContainer}
          eventBus={eventBus}
        />
      </div>
    );
  }

  // Fallback for file tabs without webcontainer
  return (
    <div className={`tab-content ${isActive ? 'tab-content-active' : 'tab-content-hidden'}`}>
      <div className="file-viewer-placeholder">
        <div className="file-viewer-placeholder-path">{tab.filePath}</div>
        <div className="file-viewer-placeholder-message">Loading...</div>
      </div>
    </div>
  );
}

// Memoize TabContent to prevent unnecessary re-renders
// We compare isActive so CSS classes update, but Terminal has its own memo
// to prevent shell restarts when switching tabs
export const TabContent = memo(TabContentInner, (prevProps, nextProps) => {
  return (
    prevProps.tab.id === nextProps.tab.id &&
    prevProps.tab.type === nextProps.tab.type &&
    prevProps.tab.command === nextProps.tab.command &&
    prevProps.tab.filePath === nextProps.tab.filePath &&
    prevProps.webContainer === nextProps.webContainer &&
    prevProps.isActive === nextProps.isActive
  );
});
