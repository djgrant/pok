import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TabContent } from './components/TabContent';
import { LoadingScreen } from './components/LoadingScreen';
import { UnsupportedBrowser } from './components/UnsupportedBrowser';
import { RefreshIcon, AlertIcon, MenuIcon } from './components/Icons';
import { useWebContainer } from './hooks/useWebContainer';
import { useBrowserSupport } from './hooks/useBrowserSupport';
import { useWorkspace } from './hooks/useWorkspace';
import { useEventBus } from './hooks/useEventBus';
import { TerminalHandle } from './components/Terminal';

export function App() {
  const { isSupported, message } = useBrowserSupport();
  const { webContainer, status, error } = useWebContainer();
  const workspace = useWorkspace();
  const eventBus = useEventBus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Track terminal refs for clearing
  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map());

  // Register a terminal ref
  const registerTerminalRef = useCallback((tabId: string, handle: TerminalHandle | null) => {
    if (handle) {
      terminalRefs.current.set(tabId, handle);
    } else {
      terminalRefs.current.delete(tabId);
    }
  }, []);

  // Clear the active terminal
  const clearActiveTerminal = useCallback(() => {
    const activeTab = workspace.tabs.find((t) => t.id === workspace.activeTabId);
    if (activeTab?.type === 'terminal') {
      const terminalHandle = terminalRefs.current.get(activeTab.id);
      terminalHandle?.clear();
    }
  }, [workspace.tabs, workspace.activeTabId]);

  // Toggle split view
  const toggleSplitView = useCallback(() => {
    if (workspace.splitTabId) {
      workspace.setSplitTab(null);
    } else {
      // Find another terminal tab to split with
      const otherTab = workspace.tabs.find(
        (t) => t.type === 'terminal' && t.id !== workspace.activeTabId
      );
      if (otherTab) {
        workspace.setSplitTab(otherTab.id);
      }
    }
  }, [workspace]);

  // Close mobile menu when clicking backdrop
  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Toggle mobile menu
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+B to toggle sidebar
      if (isMod && e.key === 'b') {
        e.preventDefault();
        workspace.toggleSidebar();
      }

      // Cmd+W to close current tab (if closeable)
      if (isMod && e.key === 'w') {
        e.preventDefault();
        const activeTab = workspace.tabs.find((t) => t.id === workspace.activeTabId);
        if (activeTab?.closeable) {
          workspace.closeTab(activeTab.id);
        }
      }

      // Cmd+\ to toggle split view
      if (isMod && e.key === '\\') {
        e.preventDefault();
        toggleSplitView();
      }

      // Cmd+K to clear active terminal
      if (isMod && e.key === 'k') {
        e.preventDefault();
        clearActiveTerminal();
      }
    },
    [workspace, toggleSplitView, clearActiveTerminal]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close mobile menu when sidebar is toggled via keyboard
  useEffect(() => {
    if (workspace.sidebarCollapsed) {
      setMobileMenuOpen(false);
    }
  }, [workspace.sidebarCollapsed]);

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
      <header className="app-header">
        <div className="app-header-left">
          <button
            className="mobile-menu-button"
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <MenuIcon size={18} />
          </button>
          <div className="app-header-title">
            <span className="app-wordmark">pok</span>
            <span className="app-header-subtitle">playground</span>
          </div>
        </div>
        <button
          className="app-header-reset"
          onClick={() => window.location.reload()}
          aria-label="Reset playground"
        >
          <RefreshIcon size={14} />
          Reset
        </button>
      </header>

      <div className="app-body">
        {/* Mobile menu backdrop */}
        {mobileMenuOpen && (
          <div
            className="mobile-menu-backdrop"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}

        <Sidebar
          tabs={workspace.tabs}
          activeTabId={workspace.activeTabId}
          collapsed={workspace.sidebarCollapsed}
          expandedFolders={workspace.expandedFolders}
          webcontainer={webContainer}
          eventBus={eventBus}
          onTabClick={(id) => {
            workspace.setActiveTab(id);
            setMobileMenuOpen(false);
          }}
          onToggle={workspace.toggleSidebar}
          onToggleFolder={workspace.toggleFolder}
          onFileClick={(filePath) => {
            workspace.openFileTab(filePath);
            setMobileMenuOpen(false);
          }}
          mobileOpen={mobileMenuOpen}
        />

        <div className="content-area">
          <TabBar
            tabs={workspace.tabs}
            activeTabId={workspace.activeTabId}
            onTabClick={workspace.setActiveTab}
            onTabClose={workspace.closeTab}
          />

          <div className={`content-main ${workspace.splitTabId ? 'content-main-split' : ''}`}>
            {workspace.tabs.map((tab) => {
              const isActive = tab.id === workspace.activeTabId;
              const isSplit = tab.id === workspace.splitTabId;
              const isVisible = isActive || isSplit;
              
              return (
                <TabContent
                  key={tab.id}
                  tab={tab}
                  webContainer={webContainer}
                  isActive={isVisible}
                  eventBus={eventBus}
                  onTerminalRef={(handle) => registerTerminalRef(tab.id, handle)}
                  onTitleChange={workspace.updateTabTitle}
                  onTaskComplete={workspace.setTaskComplete}
                />
              );
            })}
          </div>
        </div>
      </div>

      <footer className="shortcuts-bar">
        <span className="shortcut-hint">
          <kbd>Cmd</kbd>+<kbd>B</kbd> Toggle sidebar
        </span>
        <span className="shortcut-hint">
          <kbd>Cmd</kbd>+<kbd>K</kbd> Clear terminal
        </span>
        <span className="shortcut-hint">
          <kbd>Cmd</kbd>+<kbd>W</kbd> Close tab
        </span>
      </footer>
    </div>
  );
}
