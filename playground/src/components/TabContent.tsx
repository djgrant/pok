import { useRef, useEffect } from 'react';
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
}

export function TabContent({
  tab,
  webContainer,
  isActive,
  eventBus,
  onTerminalRef,
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

  if (tab.type === 'terminal') {
    return (
      <div className={`tab-content ${isActive ? 'tab-content-active' : 'tab-content-hidden'}`}>
        <Terminal
          ref={terminalRef}
          webContainer={webContainer}
          command={tab.command}
          isFocused={isActive}
          eventBus={eventBus}
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
